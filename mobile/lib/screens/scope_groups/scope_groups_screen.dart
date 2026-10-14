import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../config.dart';
import '../../main.dart';
import 'create_edit_scope_group_screen.dart';

Color parseHexColor(String? hexString) {
  if (hexString == null || hexString.isEmpty) return const Color(0xFF0B3C7A);
  try {
    final hex = hexString.replaceAll('#', '');
    return Color(int.parse('FF$hex', radix: 16));
  } catch (_) {
    return const Color(0xFF0B3C7A);
  }
}

class ScopeGroupsScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  const ScopeGroupsScreen({super.key, required this.user});

  @override
  State<ScopeGroupsScreen> createState() => _ScopeGroupsScreenState();
}

class _ScopeGroupsScreenState extends State<ScopeGroupsScreen> {
  List<dynamic> _scopeGroups = [];
  bool _isLoading = true;
  String _token = '';
  String _searchQuery = '';

  bool _isDeveloper = false;
  bool _hasAssignedScopes = false;

  bool get _canManage => _isDeveloper && !_hasAssignedScopes;

  @override
  void initState() {
    super.initState();
    // Pre-calculate permissions based on user passed from login/dashboard
    final role = widget.user['role']?.toString();
    final userScopes = widget.user['scopeGroups'];
    _isDeveloper = role == 'Developer';
    _hasAssignedScopes = (userScopes is List && userScopes.isNotEmpty);

    _loadTokenAndFetch();
  }

  Future<void> _loadTokenAndFetch() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    if (!mounted) return;
    setState(() => _token = token);
    await _fetchScopeGroups();
  }

  Future<void> _fetchScopeGroups() async {
    setState(() => _isLoading = true);
    try {
      // 1. Fetch live permission & assigned status from /my-scope
      try {
        final myScopeRes = await http.get(
          Uri.parse('$baseUrl/scope-groups/my-scope'),
          headers: {'Authorization': 'Bearer $_token'},
        );
        if (myScopeRes.statusCode == 200) {
          final myScopeData = json.decode(myScopeRes.body);
          if (myScopeData is Map) {
            _hasAssignedScopes = myScopeData['hasAssignedScopes'] == true;
            _isDeveloper = myScopeData['isDeveloper'] == true;
          }
        }
      } catch (_) {}

      // 2. Fetch accessible scope groups
      final res = await http.get(
        Uri.parse('$baseUrl/scope-groups'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (mounted) {
          setState(() {
            _scopeGroups = data is List ? data : [];
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load scope groups (${res.statusCode})')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading scope groups: $e')),
        );
      }
    }
  }

  void _navigateToCreate() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CreateEditScopeGroupScreen(token: _token),
      ),
    );
    if (result == true) {
      _fetchScopeGroups();
    }
  }

  void _navigateToEdit(Map<String, dynamic> group) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CreateEditScopeGroupScreen(
          group: group,
          token: _token,
        ),
      ),
    );
    if (result == true) {
      _fetchScopeGroups();
    }
  }

  void _confirmDeleteGroup(Map<String, dynamic> group) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Scope Group?'),
        content: Text(
          'Are you sure you want to delete "${group['name']}"? All associated gate and user assignments will be unlinked.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await _deleteGroup(group['id']);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteGroup(dynamic id) async {
    setState(() => _isLoading = true);
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl/scope-groups/$id'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200 || res.statusCode == 204) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Scope group deleted successfully'), backgroundColor: AppColors.success),
        );
        _fetchScopeGroups();
      } else {
        final data = json.decode(res.body);
        final err = data['error'] ?? 'Failed to delete scope group';
        if (!mounted) return;
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err), backgroundColor: AppColors.danger),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  void _navigateToGroupDetail(Map<String, dynamic> group) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ScopeGroupDetailPage(
          group: group,
          token: _token,
        ),
      ),
    );
  }

  List<dynamic> get _filteredGroups {
    if (_searchQuery.trim().isEmpty) return _scopeGroups;
    final q = _searchQuery.toLowerCase().trim();
    return _scopeGroups.where((g) {
      final name = (g['name'] ?? '').toString().toLowerCase();
      final desc = (g['description'] ?? '').toString().toLowerCase();
      return name.contains(q) || desc.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredGroups;

    // Aggregate statistics across groups
    final uniqueGates = <dynamic>{};
    final uniqueUsers = <dynamic>{};
    for (final g in _scopeGroups) {
      final gates = (g['gates'] as List?) ?? [];
      for (final item in gates) {
        final gid = item['gate']?['id'] ?? item['gateId'] ?? item['id'];
        if (gid != null) uniqueGates.add(gid);
      }
      final users = (g['users'] as List?) ?? [];
      for (final item in users) {
        final uid = item['user']?['id'] ?? item['userId'] ?? item['id'];
        if (uid != null) uniqueUsers.add(uid);
      }
    }

    return Scaffold(
      floatingActionButton: _canManage
          ? FloatingActionButton.extended(
              onPressed: _navigateToCreate,
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('New Scope Group', style: TextStyle(fontWeight: FontWeight.bold)),
            )
          : null,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchScopeGroups,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Role / Mode Banner
                  if (_hasAssignedScopes)
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.lock_outline, color: Color(0xFF1D4ED8), size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Assigned Scope View: Displaying gates restricted to your assigned operational scope.',
                              style: TextStyle(color: Color(0xFF1E40AF), fontSize: 12.5, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Top Stats Summary Card
                  Card(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    elevation: 1,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('${_scopeGroups.length}', 'Scope Groups'),
                          _buildStatItem('${uniqueGates.length}', 'Scoped Gates'),
                          if (_canManage)
                            _buildStatItem('${uniqueUsers.length}', 'Assigned Users'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Search Bar
                  TextField(
                    decoration: InputDecoration(
                      hintText: 'Search scope groups...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () => setState(() => _searchQuery = ''),
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val),
                  ),
                  const SizedBox(height: 14),

                  if (filtered.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.layers_outlined, size: 54, color: Colors.grey.shade400),
                          const SizedBox(height: 14),
                          Text(
                            _searchQuery.isNotEmpty ? 'No Matching Scope Groups' : 'No Scope Groups Found',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _canManage
                                ? 'Tap the "+ New Scope Group" button below to create one.'
                                : 'No scope groups are currently assigned to your account.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  else
                    ...filtered.map((group) {
                      final gates = (group['gates'] as List?) ?? [];
                      final users = (group['users'] as List?) ?? [];
                      final color = parseHexColor(group['color']);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        elevation: 1,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _navigateToGroupDetail(group),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 13,
                                      height: 13,
                                      decoration: BoxDecoration(
                                        color: color,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        group['name'] ?? 'Scope Group',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                    // Action Menu for Admins / Developers
                                    if (_canManage)
                                      PopupMenuButton<String>(
                                        icon: const Icon(Icons.more_vert, size: 20, color: Colors.grey),
                                        onSelected: (val) {
                                          if (val == 'edit') {
                                            _navigateToEdit(group);
                                          } else if (val == 'delete') {
                                            _confirmDeleteGroup(group);
                                          }
                                        },
                                        itemBuilder: (_) => [
                                          const PopupMenuItem(
                                            value: 'edit',
                                            child: Row(
                                              children: [
                                                Icon(Icons.edit, size: 18, color: AppColors.primary),
                                                SizedBox(width: 8),
                                                Text('Edit Group'),
                                              ],
                                            ),
                                          ),
                                          const PopupMenuItem(
                                            value: 'delete',
                                            child: Row(
                                              children: [
                                                Icon(Icons.delete_outline, size: 18, color: AppColors.danger),
                                                SizedBox(width: 8),
                                                Text('Delete Group', style: TextStyle(color: AppColors.danger)),
                                              ],
                                            ),
                                          ),
                                        ],
                                      )
                                    else
                                      const Icon(Icons.chevron_right, color: Colors.grey),
                                  ],
                                ),
                                if (group['description'] != null && group['description'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    group['description'],
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFE0F2FE),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.device_hub, size: 13, color: Color(0xFF0369A1)),
                                          const SizedBox(width: 5),
                                          Text(
                                            '${gates.length} ${gates.length == 1 ? "Gate" : "Gates"}',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF0369A1),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (_canManage) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFECFDF5),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.people_outline, size: 13, color: Color(0xFF065F46)),
                                            const SizedBox(width: 5),
                                            Text(
                                              '${users.length} ${users.length == 1 ? "User" : "Users"}',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF065F46),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                    const Spacer(),
                                    const Text(
                                      'View Gates →',
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _buildStatItem(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

/// DEDICATED SCOPE GROUP DETAIL PAGE
class ScopeGroupDetailPage extends StatefulWidget {
  final Map<String, dynamic> group;
  final String token;

  const ScopeGroupDetailPage({
    super.key,
    required this.group,
    required this.token,
  });

  @override
  State<ScopeGroupDetailPage> createState() => _ScopeGroupDetailPageState();
}

class _ScopeGroupDetailPageState extends State<ScopeGroupDetailPage> {
  late Map<String, dynamic> _group;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _group = widget.group;
  }

  void _navigateToGateDetails(Map<String, dynamic> gate) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GateDevicesDetailPage(
          gate: gate,
          token: widget.token,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gates = (_group['gates'] as List?) ?? [];
    final color = parseHexColor(_group['color']);

    final filteredGates = gates.where((item) {
      if (_searchQuery.isEmpty) return true;
      final g = (item['gate'] as Map?) ?? {};
      final q = _searchQuery.toLowerCase();
      final lc = (g['lcNumber'] ?? '').toString().toLowerCase();
      final loc = (g['locationName'] ?? '').toString().toLowerCase();
      final name = (g['name'] ?? '').toString().toLowerCase();
      return lc.contains(q) || loc.contains(q) || name.contains(q);
    }).toList();

    // Aggregate Masters & Slaves across gates
    int totalMasters = 0;
    int totalSlaves = 0;
    for (final item in gates) {
      final g = (item['gate'] as Map?) ?? {};
      final masters = (g['masters'] as List?) ?? [];
      totalMasters += masters.length;
      for (final m in masters) {
        final slaves = (m['childDevices'] as List?) ?? [];
        totalSlaves += slaves.length;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_group['name'] ?? 'Scope Group'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 1,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Scope Group Hero Card
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            elevation: 1,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _group['name'] ?? 'Scope Group',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                  if (_group['description'] != null && _group['description'].toString().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      _group['description'],
                      style: TextStyle(fontSize: 13.5, color: Colors.grey.shade700, height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildSummaryStat('${gates.length}', 'Included Gates'),
                      _buildSummaryStat('$totalMasters', 'Masters'),
                      _buildSummaryStat('$totalSlaves', 'Slaves'),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Search Bar for Gates
          TextField(
            decoration: InputDecoration(
              hintText: 'Search gates in this scope...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() => _searchQuery = ''),
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
              filled: true,
              fillColor: Colors.white,
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
          const SizedBox(height: 16),

          // Gates Section Title
          Text(
            'Included LC Gates (${filteredGates.length})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),

          if (filteredGates.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              alignment: Alignment.center,
              child: Text(
                _searchQuery.isNotEmpty ? 'No gates match your search.' : 'No gates assigned to this scope group.',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13.5),
              ),
            )
          else
            ...filteredGates.map((item) {
              final g = (item['gate'] as Map?) ?? {};
              final masters = (g['masters'] as List?) ?? [];
              int slavesCount = 0;
              for (final m in masters) {
                final sList = (m['childDevices'] as List?) ?? [];
                slavesCount += sList.length;
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                elevation: 1,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _navigateToGateDetails(g.cast<String, dynamic>()),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE0F2FE),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                g['lcNumber'] ?? 'LC-Gate',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Color(0xFF0369A1),
                                ),
                              ),
                            ),
                            const Row(
                              children: [
                                Text(
                                  'Inspect Devices',
                                  style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.chevron_right, size: 16, color: AppColors.primary),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          g['locationName'] ?? g['name'] ?? 'LC Gate',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${g['zone'] ?? ''} • ${g['division'] ?? ''}',
                          style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${masters.length} Masters',
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '$slavesCount Slaves',
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildSummaryStat(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

/// DEDICATED GATE DEVICES & TELEMETRY PAGE
class GateDevicesDetailPage extends StatefulWidget {
  final Map<String, dynamic> gate;
  final String token;

  const GateDevicesDetailPage({
    super.key,
    required this.gate,
    required this.token,
  });

  @override
  State<GateDevicesDetailPage> createState() => _GateDevicesDetailPageState();
}

class _GateDevicesDetailPageState extends State<GateDevicesDetailPage> {
  late Map<String, dynamic> _gate;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _gate = widget.gate;
    _fetchLatestGateData();
  }

  Future<void> _fetchLatestGateData() async {
    final gateId = _gate['id'];
    if (gateId == null) return;
    setState(() => _isLoading = true);
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate/$gateId'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (mounted && data is Map<String, dynamic>) {
          setState(() {
            _gate = data;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final masters = (_gate['masters'] as List?) ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text('${_gate['lcNumber'] ?? 'LC Gate'} Devices'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 1,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Gate Header Card
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  elevation: 1,
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _gate['lcNumber'] ?? 'LC Gate',
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE0F2FE),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${masters.length} ${masters.length == 1 ? "Master" : "Masters"}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0369A1)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _gate['locationName'] ?? _gate['name'] ?? 'LC Gate Location',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${_gate['zone'] ?? ''} • ${_gate['division'] ?? ''}',
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Connected Devices Section Title
                const Text(
                  'Connected Master Units & Slave Devices',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                ),
                const SizedBox(height: 12),

                if (masters.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(36),
                    alignment: Alignment.center,
                    child: Text(
                      'No master units installed at this gate yet.',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 13.5),
                    ),
                  )
                else
                  ...masters.map((master) {
                    final childDevices = (master['childDevices'] as List?) ?? [];
                    final isSolar = master['powerSource'] == 'SOLAR';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(color: Colors.grey.shade200),
                      ),
                      elevation: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Master Header
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE0F2FE),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.memory, color: Color(0xFF0284C7), size: 20),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        master['serialNumber'] ?? 'Master Unit',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15.5),
                                      ),
                                      Text(
                                        'Sequence #${master['masterSequence'] ?? 1}',
                                        style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isSolar ? const Color(0xFFFEF3C7) : const Color(0xFFDBEAFE),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        isSolar ? Icons.wb_sunny : Icons.bolt,
                                        size: 13,
                                        color: isSolar ? const Color(0xFFB45309) : const Color(0xFF1D4ED8),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        isSolar ? 'Solar' : 'Direct',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: isSolar ? const Color(0xFFB45309) : const Color(0xFF1D4ED8),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            const Divider(),
                            const SizedBox(height: 8),

                            // Slave Devices List
                            Text(
                              'Slave Devices (${childDevices.length})',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF334155)),
                            ),
                            const SizedBox(height: 8),

                            if (childDevices.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                child: Text(
                                  'No slave devices connected to this master unit.',
                                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500, fontStyle: FontStyle.italic),
                                ),
                              )
                            else
                              ...childDevices.map((dev) {
                                final isTypeA = dev['type'] == 'DEVICE_1';
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.grey.shade200),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.power_outlined, size: 18, color: Color(0xFF0284C7)),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              dev['serialNumber'] ?? 'Slave Device',
                                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              isTypeA ? 'Hall Effect + Limit Switch' : 'Tilt Sensor',
                                              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE0F2FE),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          isTypeA ? 'Type A' : 'Type B',
                                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF0369A1)),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}
