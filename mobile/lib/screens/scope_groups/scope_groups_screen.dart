import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../config.dart';
import '../../main.dart';

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

  Color _parseColor(String? hexString) {
    if (hexString == null || hexString.isEmpty) return const Color(0xFF0B3C7A);
    try {
      final hex = hexString.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return const Color(0xFF0B3C7A);
    }
  }

  void _showGroupDetails(Map<String, dynamic> group) {
    final gates = (group['gates'] as List?) ?? [];
    final users = (group['users'] as List?) ?? [];
    final color = _parseColor(group['color']);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.65,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (_, scrollController) {
            return Container(
              padding: const EdgeInsets.all(20),
              child: ListView(
                controller: scrollController,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          group['name'] ?? 'Scope Group',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  if (group['description'] != null && group['description'].toString().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      group['description'],
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13.5),
                    ),
                  ],
                  const SizedBox(height: 20),
                  const Divider(),
                  const SizedBox(height: 10),

                  // Gates List
                  Row(
                    children: [
                      const Icon(Icons.device_hub, size: 18, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Included Gates (${gates.length})',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (gates.isEmpty)
                    Text('No gates in this group.', style: TextStyle(color: Colors.grey.shade500, fontSize: 13))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: gates.map((item) {
                        final g = item['gate'] ?? {};
                        final lcNum = g['lcNumber'] ?? '';
                        final loc = g['locationName'] ?? '';
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: Text(
                            '$lcNum ${loc.isNotEmpty ? "($loc)" : ""}',
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                          ),
                        );
                      }).toList(),
                    ),

                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 10),

                  // Users List
                  Row(
                    children: [
                      const Icon(Icons.people_outline, size: 18, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Assigned Team Members (${users.length})',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (users.isEmpty)
                    Text('No members assigned.', style: TextStyle(color: Colors.grey.shade500, fontSize: 13))
                  else
                    ...users.map((item) {
                      final u = item['user'] ?? {};
                      final name = u['fullName'] ?? 'User';
                      final email = u['email'] ?? '';
                      final role = (u['role'] is Map) ? (u['role']['name'] ?? '') : '';
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary,
                          radius: 16,
                          child: Text(
                            name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'U',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                        subtitle: Text('$email ${role.isNotEmpty ? "• $role" : ""}', style: const TextStyle(fontSize: 12)),
                      );
                    }),
                ],
              ),
            );
          },
        );
      },
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
                            'Create scope groups on the Web Console to manage access.',
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
                        final users = (group['users'] as List?) ?? [];
                        final color = _parseColor(group['color']);

                        return Card(
                          margin: const EdgeInsets.only(bottom: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.grey.shade200),
                          ),
                          elevation: 1,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => _showGroupDetails(group),
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
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE0F2FE),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.device_hub, size: 14, color: Color(0xFF0369A1)),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${gates.length} ${gates.length == 1 ? "Gate" : "Gates"}',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF0369A1),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFECFDF5),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.people_outline, size: 14, color: Color(0xFF047857)),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${users.length} ${users.length == 1 ? "User" : "Users"}',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF047857),
                                              ),
                                            ),
                                          ],
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
