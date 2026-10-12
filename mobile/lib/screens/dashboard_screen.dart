import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../config.dart';
import '../main.dart';
import 'roles_screen.dart';
import 'branding_screen.dart';
import 'registration_builder_screen.dart';
import 'cluster/cluster_main_screen.dart';

class DashboardScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const DashboardScreen({super.key, required this.user, required this.onLogout});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

const List<Map<String, String>> _defaultModules = [
  {'name': 'Manage Users', 'slug': 'manage-users'},
  {'name': 'Roles', 'slug': 'roles'},
  {'name': 'Registration Builder', 'slug': 'registration'},
  {'name': 'Branding', 'slug': 'branding'},
  {'name': 'Cluster', 'slug': 'cluster'},
];

class _DashboardScreenState extends State<DashboardScreen> {
  List<dynamic> _users = [];
  List<dynamic> _roles = [];
  List<dynamic> _systemModules = List.from(_defaultModules);
  bool _isLoading = false;
  String _currentView = 'home';
  String _appName = 'LC Platform';

  bool get _canManageUsers =>
      widget.user['role'] == 'Developer' ||
      ((widget.user['allowedModules'] as List?)?.contains('manage-users') ?? false);

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<String> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token') ?? '';
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    final token = await _getToken();
    final headers = {'Authorization': 'Bearer $token'};
    try {
      final futures = <Future<http.Response>>[
        _canManageUsers
            ? http.get(Uri.parse('$baseUrl/users'), headers: headers)
            : Future.value(http.Response('{"users":[],"pendingRequests":[]}', 200)),
        http.get(Uri.parse('$baseUrl/roles'), headers: headers),
        http.get(Uri.parse('$baseUrl/modules'), headers: headers),
        http.get(Uri.parse('$baseUrl/settings/branding')),
      ];
      final results = await Future.wait(futures);

      final resUsers = results[0];
      final resRoles = results[1];
      final resMods = results[2];
      final resBranding = results[3];

      setState(() {
        try {
          final data = json.decode(resUsers.body);
          _users = data is Map && data['users'] != null ? data['users'] : [];
          _pendingRequests = data is Map && data['pendingRequests'] != null ? data['pendingRequests'] : [];
        } catch (_) {}
        
        try {
          final rolesData = json.decode(resRoles.body);
          _roles = rolesData is List ? rolesData : [];
        } catch (_) {}
        
        try {
          final modsData = json.decode(resMods.body);
          if (modsData is List && modsData.isNotEmpty) {
            _systemModules = modsData;
          }
        } catch (_) {}

        try {
          final brandingData = json.decode(resBranding.body);
          if (brandingData is Map && brandingData['appName'] != null) {
            _appName = brandingData['appName'];
          }
        } catch (_) {}
      });
    } catch (e) {
      print(e);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  List<dynamic> _pendingRequests = [];

  Future<void> _actionUser(int id, String action, [Map<String, dynamic>? body, bool isRequest = false]) async {
    final token = await _getToken();
    final endpoint = isRequest ? 'request/$id/$action' : '$id/$action';
    try {
      await http.put(
        Uri.parse('https://lc-platform.onrender.com/api/v1/users/$endpoint'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: body != null ? json.encode(body) : null
      ).catchError((_) => http.put(
        Uri.parse('$baseUrl/users/$endpoint'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: body != null ? json.encode(body) : null
      ));
      _fetchData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Action completed successfully!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      print(e);
    }
  }

  Future<void> _confirmAction(Map<String, dynamic> user, String action) async {
    final isDeactivate = action == 'deactivate';
    bool confirm = await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isDeactivate ? 'Deactivate User?' : 'Reactivate User?'),
        content: Text(isDeactivate 
          ? 'Are you sure you want to deactivate ${user['fullName']}? They will not be able to log in.' 
          : 'Are you sure you want to reactivate ${user['fullName']}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: isDeactivate ? Colors.red : Colors.green),
            onPressed: () => Navigator.pop(context, true),
            child: Text(isDeactivate ? 'Deactivate' : 'Reactivate'),
          ),
        ],
      ),
    ) ?? false;

    if (confirm) {
      await _actionUser(user['id'], action);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _systemModules.isEmpty) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final isDev = widget.user['role'] == 'Developer';
    
    IconData getIconForModule(String slug) {
      switch (slug) {
        case 'manage-users': return Icons.group;
        case 'roles': return Icons.security;
        case 'branding': return Icons.brush;
        case 'registration': return Icons.build;
        case 'cluster': return Icons.device_hub;
        default: return Icons.extension;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_appName, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)), 
        backgroundColor: AppColors.surface,
        actions: [
          if (_currentView == 'manage-users')
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
              onPressed: _fetchData,
            )
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: AppColors.surface),
              child: Row(
                children: [
                  CircleAvatar(backgroundColor: AppColors.secondary, child: Text(widget.user['fullName'].substring(0,2).toUpperCase(), style: const TextStyle(color: Colors.white))),
                  const SizedBox(width: 16),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.user['fullName'], style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text(widget.user['role'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  )
                ],
              )
            ),
            ListTile(title: const Text('Home'), leading: const Icon(Icons.home), onTap: () {
              setState(() { _currentView = 'home'; });
              Navigator.pop(context);
            }),
            ..._systemModules.where((m) {
              if (widget.user['role'] == 'Developer') return true;
              final allowed = widget.user['allowedModules'];
              return allowed is List && allowed.contains(m['slug']);
            }).map((m) {
              return ListTile(
                title: Text(m['name']),
                leading: Icon(getIconForModule(m['slug'])),
                onTap: () {
                  setState(() { _currentView = m['slug']; });
                  Navigator.pop(context);
                }
              );
            }).toList(),

            ListTile(title: const Text('Logout', style: TextStyle(color: AppColors.danger)), leading: const Icon(Icons.logout, color: AppColors.danger), onTap: widget.onLogout),
          ],
        )
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_currentView == 'home') return _buildUserDashboard();
    if (_currentView == 'manage-users') return _buildAdminDashboard();
    if (_currentView == 'roles') return RolesScreen(user: widget.user);
    if (_currentView == 'branding') return BrandingScreen(user: widget.user);
    if (_currentView == 'registration') return RegistrationBuilderScreen(user: widget.user);
    if (_currentView == 'cluster') return const ClusterMainScreen();
    
    return Center(child: Text('Module $_currentView not implemented yet.'));
  }

  Widget _buildUserDashboard() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('Welcome to LC Platform', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Text('You are logged in as ${widget.user['role']}', style: const TextStyle(color: Colors.grey)),
        ],
      )
    );
  }

  Widget _buildAdminDashboard() {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          TabBar(
            labelColor: AppColors.primary,
            tabs: [
              const Tab(text: 'Existing Users'),
              Tab(text: 'Pending Approval (${_pendingRequests.length})'),
            ]
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildExistingUsersTab(),
                _buildPendingUsersTab(_pendingRequests),
              ]
            )
          )
        ],
      ),
    );
  }

  Widget _buildPendingUsersTab(List<dynamic> pending) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (pending.isEmpty) return const Center(child: Text('No pending requests.'));
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: pending.length,
      itemBuilder: (c, i) {
        final req = pending[i];
        final reqData = json.decode(req['data'] ?? '{}');
        final form = req['form'] as Map<String, dynamic>?;
        int selectedRole = req['requestedRoleId'] ?? (_roles.isNotEmpty ? _roles[0]['id'] : 0);

        // Find best display name for user
        String displayName = reqData['fullName'] ?? '';
        if (displayName.isEmpty) {
          for (var entry in reqData.entries) {
            final info = _resolveFieldInfo(form, entry.key);
            if (info['label'].toString().toLowerCase().contains('name') && entry.value.toString().isNotEmpty) {
              displayName = entry.value.toString();
              break;
            }
          }
        }
        if (displayName.isEmpty) displayName = 'Pending User';
        
        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          color: Colors.white,
          margin: const EdgeInsets.only(bottom: 16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primary)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: Colors.orange.shade100, borderRadius: BorderRadius.circular(16)),
                      child: Text('PENDING', style: TextStyle(color: Colors.orange.shade900, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                if (form != null && form['name'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Form: ${form['name']}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic)),
                  ),
                const Divider(height: 24),
                ...reqData.entries.where((e) => !e.key.toLowerCase().contains('password')).map((e) {
                  final fieldInfo = _resolveFieldInfo(form, e.key);
                  final label = fieldInfo['label'] ?? e.key;
                  final isImg = _isImageUrl(e.value, fieldInfo['type']);

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 2, child: Text(label, style: TextStyle(color: Colors.grey.shade700, fontSize: 13, fontWeight: FontWeight.w600))),
                        Expanded(
                          flex: 3, 
                          child: isImg
                              ? Align(alignment: Alignment.centerLeft, child: _buildImageThumbnail(e.value.toString(), label))
                              : Text(e.value.toString(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12),
                Text('Requested Role ID: ${req['requestedRoleId']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.secondary)),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  value: selectedRole,
                  decoration: InputDecoration(
                    labelText: 'Assign Role',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)
                  ),
                  items: _roles.map((e) => DropdownMenuItem<int>(value: e['id'], child: Text(e['name']))).toList(),
                  onChanged: (v) => selectedRole = v!,
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.success, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)), padding: const EdgeInsets.symmetric(vertical: 12)),
                      onPressed: () => _actionUser(req['id'], 'approve', {'roleId': selectedRole}, true),
                      child: const Text('Approve', style: TextStyle(fontWeight: FontWeight.bold)),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: OutlinedButton(
                      style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)), padding: const EdgeInsets.symmetric(vertical: 12)),
                      onPressed: () => _actionUser(req['id'], 'reject', {'reason': 'Rejected by admin'}, true),
                      child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                    )),
                  ],
                )
              ],
            ),
          )
        );
      }
    );
  }

  Map<String, dynamic> _resolveFieldInfo(Map<String, dynamic>? form, String key) {
    if (form != null && form['schema'] != null) {
      try {
        final schemaRaw = form['schema'];
        final schema = schemaRaw is String ? json.decode(schemaRaw) : schemaRaw;
        final fields = schema is Map ? (schema['fields'] as List? ?? []) : (schema is List ? schema : []);
        
        Map<String, dynamic>? findInList(List<dynamic> list) {
          for (var item in list) {
            if (item is Map) {
              if (item['type'] == 'section' && item['children'] is List) {
                final found = findInList(item['children']);
                if (found != null) return found;
              } else if (item['name'] == key || item['id'] == key) {
                return Map<String, dynamic>.from(item);
              }
            }
          }
          return null;
        }

        final match = findInList(fields);
        if (match != null && match['label'] != null && match['label'].toString().trim().isNotEmpty) {
          return {
            'label': match['label'].toString(),
            'type': match['type']?.toString() ?? 'text'
          };
        }
      } catch (_) {}
    }

    return {'label': _humanizeKey(key), 'type': 'text'};
  }

  String _humanizeKey(String key) {
    if (key == 'fullName') return 'Full Name';
    if (key == 'mobile') return 'Mobile Number';
    if (key == 'email') return 'Email Address';
    if (key == 'employeeId') return 'Employee ID';
    if (key == 'department') return 'Department';
    if (key == 'roleId') return 'Requested Role ID';
    if (key.startsWith('field_')) {
      final sub = key.substring(6);
      return sub.length > 6 ? 'Custom Field (${sub.substring(sub.length - 4)})' : 'Custom Field ($sub)';
    }
    final spaced = key.replaceAllMapped(RegExp(r'([A-Z])'), (m) => ' ${m[0]}').replaceAll('_', ' ').trim();
    if (spaced.isEmpty) return key;
    return spaced[0].toUpperCase() + spaced.substring(1);
  }

  bool _isImageUrl(dynamic val, String? type) {
    if (val == null) return false;
    final str = val.toString().trim();
    if (type == 'image') return true;
    if (str.startsWith('http://') || str.startsWith('https://')) {
      final lower = str.toLowerCase();
      if (lower.contains('/image/upload/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
        return true;
      }
    }
    return false;
  }

  Widget _buildImageThumbnail(String url, String label) {
    return InkWell(
      onTap: () {
        showDialog(
          context: context,
          builder: (ctx) => Dialog(
            backgroundColor: Colors.transparent,
            insetPadding: const EdgeInsets.all(16),
            child: Stack(
              alignment: Alignment.topRight,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          url,
                          fit: BoxFit.contain,
                          loadingBuilder: (c, child, p) => p == null ? child : const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
                          errorBuilder: (c, e, s) => const Padding(padding: EdgeInsets.all(24), child: Text('Failed to load image')),
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: IconButton(
                    icon: const CircleAvatar(backgroundColor: Colors.black54, radius: 14, child: Icon(Icons.close, color: Colors.white, size: 16)),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ),
              ],
            ),
          ),
        );
      },
      child: Container(
        height: 60,
        width: 90,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade300),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Image.network(
              url,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (context, error, stackTrace) => const Center(child: Icon(Icons.broken_image, size: 20, color: Colors.grey)),
            ),
            Positioned(
              bottom: 2,
              right: 2,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
                child: const Icon(Icons.zoom_in, color: Colors.white, size: 12),
              ),
            )
          ],
        ),
      ),
    );
  }

  String? _expandedRole;

  Widget _buildExistingUsersTab() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    
    final Map<String, List<dynamic>> grouped = {};
    for (var u in _users) {
      if (u['status'] == 'PENDING') continue;
      final rn = u['role']?['name'] ?? 'Unknown';
      if (!grouped.containsKey(rn)) grouped[rn] = [];
      grouped[rn]!.add(u);
    }
    
    return ListView(
      padding: const EdgeInsets.all(16),
      children: grouped.entries.map((e) {
        final isExpanded = _expandedRole == e.key;
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Column(
            children: [
              ListTile(
                onTap: () {
                  setState(() {
                    _expandedRole = isExpanded ? null : e.key;
                  });
                },
                leading: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(16)),
                  child: Text('${e.value.length}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                title: Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold)),
                trailing: Icon(isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down),
              ),
              if (isExpanded)
                Container(
                  color: Colors.grey[50],
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: e.value.map((u) {
                      Map<String, dynamic> metadata = {};
                      try {
                        if (u['metadata'] != null) {
                          metadata = json.decode(u['metadata']);
                        }
                      } catch (_) {}
                      
                      List<Widget> metaWidgets = [];
                      metadata.forEach((k, v) {
                        if (k.toLowerCase().contains('password')) return;
                        final displayKey = _humanizeKey(k);
                        final isImg = _isImageUrl(v, null);
                        
                        metaWidgets.add(
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(flex: 2, child: Text(displayKey, style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500))),
                                Expanded(
                                  flex: 3, 
                                  child: isImg
                                      ? Align(alignment: Alignment.centerLeft, child: _buildImageThumbnail(v.toString(), displayKey))
                                      : Text(v.toString(), style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                                ),
                              ],
                            ),
                          )
                        );
                      });

                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(color: Colors.grey.shade300)
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(u['fullName'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                        Text('${u['employeeId']} | ${u['department']}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: u['status'] == 'APPROVED' ? AppColors.success : Colors.grey, borderRadius: BorderRadius.circular(16)),
                                    child: Text(u['status'], style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              if (metaWidgets.isNotEmpty) ...[
                                const Divider(height: 24),
                                ...metaWidgets
                              ],
                              const SizedBox(height: 12),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton.icon(
                                  style: TextButton.styleFrom(foregroundColor: u['status'] == 'DEACTIVATED' ? AppColors.success : AppColors.danger),
                                  icon: Icon(u['status'] == 'DEACTIVATED' ? Icons.check_circle : Icons.block, size: 18),
                                  label: Text(u['status'] == 'DEACTIVATED' ? 'Reactivate User' : 'Deactivate User'),
                                  onPressed: () async {
                                    final isDeactivated = u['status'] == 'DEACTIVATED';
                                    final actionName = isDeactivated ? 'reactivate' : 'deactivate';
                                    
                                    final confirm = await showDialog<bool>(
                                      context: context,
                                      builder: (context) => AlertDialog(
                                        title: Text('Confirm ${isDeactivated ? 'Reactivation' : 'Deactivation'}'),
                                        content: Text('Are you sure you want to $actionName this user?'),
                                        actions: [
                                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                                          ElevatedButton(
                                            onPressed: () => Navigator.pop(context, true),
                                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                                            child: const Text('Confirm', style: TextStyle(color: Colors.white)),
                                          ),
                                        ],
                                      )
                                    );
                                    if (confirm == true) {
                                      _actionUser(u['id'], actionName);
                                    }
                                  },
                                ),
                              )
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                )
            ],
          )
        );
      }).toList(),
    );
  }
}
