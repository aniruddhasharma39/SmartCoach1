import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../config.dart';
import '../../main.dart';

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

  @override
  void initState() {
    super.initState();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchScopeGroups,
              child: _scopeGroups.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.layers_outlined, size: 54, color: Colors.grey.shade400),
                          const SizedBox(height: 14),
                          const Text(
                            'No Scope Groups Found',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'No scope groups are currently assigned to your account.',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _scopeGroups.length,
                      itemBuilder: (context, index) {
                        final group = _scopeGroups[index];
                        final gates = (group['gates'] as List?) ?? [];
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
                                        width: 12,
                                        height: 12,
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
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE0F2FE),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.device_hub, size: 14, color: Color(0xFF0369A1)),
                                            const SizedBox(width: 5),
                                            Text(
                                              '${gates.length} ${gates.length == 1 ? "Gate" : "Gates"} Included',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF0369A1),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
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
                      },
                    ),
            ),
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
