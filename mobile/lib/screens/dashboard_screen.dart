import 'dart:async';
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
import 'profile_screen.dart';

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

  // Notifications State
  List<dynamic> _notifications = [];
  int _unreadNotifsCount = 0;
  Timer? _notifsTimer;

  bool get _canManageUsers =>
      widget.user['role'] == 'Developer' ||
      ((widget.user['allowedModules'] as List?)?.contains('manage-users') ?? false);

  @override
  void initState() {
    super.initState();
    _fetchData();
    _fetchNotifications();
    _notifsTimer = Timer.periodic(const Duration(seconds: 30), (_) => _fetchNotifications());
  }

  @override
  void dispose() {
    _notifsTimer?.cancel();
    super.dispose();
  }

  Future<String> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token') ?? '';
  }

  Future<void> _fetchNotifications() async {
    try {
      final token = await _getToken();
      if (token.isEmpty) return;
      final res = await http.get(
        Uri.parse('$baseUrl/notifications'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (mounted && data is Map) {
          setState(() {
            _notifications = List.from(data['notifications'] ?? []);
            final rawCount = data['unreadCount'];
            _unreadNotifsCount = rawCount is int ? rawCount : (int.tryParse(rawCount?.toString() ?? '0') ?? 0);
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _markAllNotifsRead() async {
    try {
      final token = await _getToken();
      await http.post(
        Uri.parse('$baseUrl/notifications/read-all'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (mounted) {
        setState(() {
          for (var n in _notifications) {
            n['read'] = true;
          }
          _unreadNotifsCount = 0;
        });
      }
    } catch (_) {}
  }

  Future<void> _markNotificationRead(String id) async {
    try {
      final token = await _getToken();
      await http.put(
        Uri.parse('$baseUrl/notifications/$id/read'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (mounted) {
        setState(() {
          final item = _notifications.firstWhere((n) => n['id'].toString() == id, orElse: () => null);
          if (item != null && item['read'] != true) {
            item['read'] = true;
            if (_unreadNotifsCount > 0) _unreadNotifsCount--;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _dismissNotification(String id) async {
    if (mounted) {
      setState(() {
        final item = _notifications.firstWhere((n) => n['id'].toString() == id, orElse: () => null);
        if (item != null && item['read'] != true && _unreadNotifsCount > 0) {
          _unreadNotifsCount--;
        }
        _notifications.removeWhere((n) => n['id'].toString() == id);
      });
    }
    try {
      final token = await _getToken();
      await http.delete(
        Uri.parse('$baseUrl/notifications/$id'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (_) {}
  }

  String _formatRelativeTime(dynamic dateStr) {
    if (dateStr == null) return '';
    try {
      final date = DateTime.parse(dateStr.toString()).toLocal();
      final diff = DateTime.now().difference(date);
      if (diff.inSeconds < 60) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return '';
    }
  }

  void _showNotificationsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.78,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag Handle
                  Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 6),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.notifications_active, color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text(
                                  'Notifications',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textMain),
                                ),
                                if (_unreadNotifsCount > 0) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.danger,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '$_unreadNotifsCount new',
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const Text(
                              'Swipe left/right or tap ✕ to dismiss',
                              style: TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                          ],
                        ),
                        const Spacer(),
                        if (_notifications.any((n) => n['read'] != true))
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: () async {
                              await _markAllNotifsRead();
                              setSheetState(() {});
                            },
                            icon: const Icon(Icons.done_all, size: 15, color: AppColors.primary),
                            label: const Text(
                              'Mark all read',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                            ),
                          ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.close, size: 20, color: Colors.grey),
                          onPressed: () => Navigator.pop(sheetContext),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                  ),

                  const Divider(height: 1, thickness: 1),

                  // Notifications List
                  Expanded(
                    child: _notifications.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(vertical: 50, horizontal: 24),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.notifications_none_rounded, size: 58, color: Colors.grey.shade400),
                                const SizedBox(height: 12),
                                const Text(
                                  'No notifications yet',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textMain),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  "You're all caught up! New requests, clusters, and devices will appear here.",
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12, color: Colors.grey),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            shrinkWrap: true,
                            itemCount: _notifications.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final item = _notifications[index];
                              final isRead = item['read'] == true;
                              final notifType = item['type'] ?? 'info';
                              final itemId = item['id'].toString();

                              IconData typeIcon = Icons.notifications;
                              Color iconColor = AppColors.primary;
                              Color iconBg = AppColors.primary.withOpacity(0.1);

                              if (notifType == 'request') {
                                typeIcon = Icons.person_add_alt_1_rounded;
                                iconColor = Colors.orange.shade700;
                                iconBg = Colors.orange.shade50;
                              } else if (notifType == 'cluster') {
                                typeIcon = Icons.device_hub_rounded;
                                iconColor = Colors.blue.shade700;
                                iconBg = Colors.blue.shade50;
                              } else if (notifType == 'device') {
                                typeIcon = Icons.router_rounded;
                                iconColor = Colors.teal.shade700;
                                iconBg = Colors.teal.shade50;
                              }

                              return Dismissible(
                                key: Key(itemId),
                                direction: DismissDirection.horizontal,
                                background: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade400,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  alignment: Alignment.centerLeft,
                                  padding: const EdgeInsets.symmetric(horizontal: 18),
                                  child: Row(
                                    children: const [
                                      Icon(Icons.delete_outline, color: Colors.white, size: 20),
                                      SizedBox(width: 6),
                                      Text('Dismiss', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                    ],
                                  ),
                                ),
                                secondaryBackground: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade400,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  alignment: Alignment.centerRight,
                                  padding: const EdgeInsets.symmetric(horizontal: 18),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: const [
                                      Text('Dismiss', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                                      SizedBox(width: 6),
                                      Icon(Icons.delete_outline, color: Colors.white, size: 20),
                                    ],
                                  ),
                                ),
                                onDismissed: (direction) {
                                  _dismissNotification(itemId);
                                  setSheetState(() {});
                                },
                                child: InkWell(
                                  onTap: () {
                                    if (!isRead) {
                                      _markNotificationRead(itemId);
                                    }
                                    Navigator.pop(sheetContext);
                                    if (item['link'] != null) {
                                      setState(() {
                                        _currentView = item['link'];
                                      });
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: isRead ? Colors.white : const Color(0xFFF0FDF4).withOpacity(0.6),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isRead ? Colors.grey.shade200 : AppColors.primary.withOpacity(0.3),
                                        width: isRead ? 1 : 1.5,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.02),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        )
                                      ],
                                    ),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Type Icon Avatar
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: iconBg,
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(typeIcon, color: iconColor, size: 20),
                                        ),
                                        const SizedBox(width: 12),

                                        // Content
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  if (!isRead) ...[
                                                    Container(
                                                      width: 7,
                                                      height: 7,
                                                      margin: const EdgeInsets.only(right: 6),
                                                      decoration: const BoxDecoration(
                                                        color: AppColors.primary,
                                                        shape: BoxShape.circle,
                                                      ),
                                                    ),
                                                  ],
                                                  Expanded(
                                                    child: Text(
                                                      item['title'] ?? 'Notification',
                                                      style: TextStyle(
                                                        fontWeight: isRead ? FontWeight.w600 : FontWeight.bold,
                                                        fontSize: 13.5,
                                                        color: AppColors.textMain,
                                                      ),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                  Text(
                                                    _formatRelativeTime(item['createdAt']),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: Colors.grey.shade500,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                item['message'] ?? '',
                                                style: TextStyle(
                                                  fontSize: 12.5,
                                                  color: Colors.grey.shade700,
                                                  height: 1.3,
                                                ),
                                              ),
                                              if (item['link'] != null) ...[
                                                const SizedBox(height: 6),
                                                Row(
                                                  children: const [
                                                    Text(
                                                      'Tap to view details',
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w600,
                                                        color: AppColors.primary,
                                                      ),
                                                    ),
                                                    SizedBox(width: 2),
                                                    Icon(Icons.arrow_forward, size: 11, color: AppColors.primary),
                                                  ],
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 6),

                                        // Individual "x" icon to dismiss
                                        IconButton(
                                          icon: Icon(Icons.close, size: 16, color: Colors.grey.shade400),
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(),
                                          tooltip: 'Dismiss',
                                          onPressed: () {
                                            _dismissNotification(itemId);
                                            setSheetState(() {});
                                          },
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _systemModules.isEmpty) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    
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
        centerTitle: false,
        titleSpacing: NavigationToolbar.kMiddleSpacing,
        title: Text(
          _appName,
          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 18),
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
        backgroundColor: AppColors.surface,
        actions: [
          if (_currentView == 'manage-users')
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              tooltip: 'Refresh',
              onPressed: _fetchData,
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(),
            ),
          // Bell Icon before avatar icon in header in the right top corner
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: AppColors.textMain, size: 22),
                tooltip: 'Notifications',
                onPressed: _showNotificationsSheet,
                padding: const EdgeInsets.all(8),
                constraints: const BoxConstraints(),
              ),
              if (_unreadNotifsCount > 0)
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Center(
                      child: Text(
                        _unreadNotifsCount > 9 ? '9+' : '$_unreadNotifsCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 4),
          // Avatar Icon in right top corner
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => ProfileScreen(user: widget.user)),
              );
            },
            borderRadius: BorderRadius.circular(18),
            child: Tooltip(
              message: 'Profile Settings',
              child: CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.primary,
                child: Text(
                  widget.user['fullName'] != null && widget.user['fullName'].toString().isNotEmpty
                      ? widget.user['fullName'].toString().substring(0, widget.user['fullName'].toString().length >= 2 ? 2 : 1).toUpperCase()
                      : 'U',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB), width: 1)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: AppColors.secondary,
                        child: Text(
                          widget.user['fullName'] != null && widget.user['fullName'].toString().isNotEmpty
                              ? widget.user['fullName'].toString().substring(0, widget.user['fullName'].toString().length >= 2 ? 2 : 1).toUpperCase()
                              : 'U',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.user['fullName'] ?? 'User',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.user['role'] ?? '',
                              style: const TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Profile Settings button below role and above divider before Home
                  InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => ProfileScreen(user: widget.user)),
                      );
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.primary.withOpacity(0.25)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.person_outline_rounded, size: 16, color: AppColors.primary),
                          SizedBox(width: 6),
                          Text(
                            'Profile Settings',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.chevron_right, size: 16, color: AppColors.primary),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE5E7EB)),
            ListTile(
              title: const Text('Home'),
              leading: const Icon(Icons.home),
              onTap: () {
                setState(() { _currentView = 'home'; });
                Navigator.pop(context);
              },
            ),
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

            ListTile(
              title: const Text('Logout', style: TextStyle(color: AppColors.danger)),
              leading: const Icon(Icons.logout, color: AppColors.danger),
              onTap: widget.onLogout,
            ),
          ],
        ),
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
