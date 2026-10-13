import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'create_gate_screen.dart';
import 'gate_detail_screen.dart';

import 'package:shared_preferences/shared_preferences.dart';
import '../../config.dart';
import '../../main.dart';
import 'railway_data.dart';

class ClusterMainScreen extends StatefulWidget {
  const ClusterMainScreen({super.key});

  @override
  State<ClusterMainScreen> createState() => _ClusterMainScreenState();
}

class _ClusterMainScreenState extends State<ClusterMainScreen> {
  List<dynamic> _gates = [];
  bool _isLoading = true;
  String _token = '';

  // Zone/Division reference data
  List<String> _zones = RailwayData.zones;
  Map<String, List<String>> _divisionsByZone = RailwayData.data;

  // Filters & sort
  String _filterZone = '';
  String _filterDivision = '';
  String _filterLocation = '';
  String _filterName = '';
  String _filterLc = '';
  String _sortBy = 'newest';

  static const List<Map<String, String>> _sortOptions = [
    {'value': 'newest', 'label': 'Newest First'},
    {'value': 'name_asc', 'label': 'Gate Name (A–Z)'},
    {'value': 'name_desc', 'label': 'Gate Name (Z–A)'},
    {'value': 'lc_asc', 'label': 'LC Number (Ascending)'},
    {'value': 'zone_asc', 'label': 'Zone (A–Z)'},
    {'value': 'location_asc', 'label': 'Location (A–Z)'},
  ];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    if (!mounted) return;
    setState(() => _token = token);
    await _fetchGates();
    await _fetchReferenceData();
  }

  Future<void> _fetchReferenceData() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate/reference-data'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data is Map) {
          final zones = (data['zones'] as List?)?.whereType<String>().toList() ?? [];
          final divisionsRaw = data['divisionsByZone'];
          if (zones.isNotEmpty && mounted) {
            setState(() {
              _zones = zones;
              if (divisionsRaw is Map) {
                _divisionsByZone = divisionsRaw.map(
                  (k, v) => MapEntry(k.toString(), (v as List).whereType<String>().toList()),
                );
              }
            });
          }
        }
      }
    } catch (e) {
      print('Error fetching zone/division reference data: $e');
    }
  }

  Future<void> _fetchGates() async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200) {
        setState(() {
          _gates = json.decode(res.body);
        });
      } else if (res.statusCode == 401) {
        if (mounted) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('token');
          await prefs.remove('user');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Your session has expired. Please log in again.')),
          );
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const AuthWrapper()),
            (route) => false,
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load clusters: ${res.statusCode}')),
          );
        }
      }
    } catch (e) {
      print('Error fetching gates: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Network error loading clusters: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  bool get _hasActiveFilters =>
      _filterZone.isNotEmpty ||
      _filterDivision.isNotEmpty ||
      _filterLocation.isNotEmpty ||
      _filterName.isNotEmpty ||
      _filterLc.isNotEmpty ||
      _sortBy != 'newest';

  List<dynamic> get _visibleGates {
    final filtered = _gates.where((g) {
      final zone = (g['zone'] as String?) ?? '';
      final division = (g['division'] as String?) ?? '';
      final location = (g['locationName'] as String?) ?? '';
      final name = (g['name'] as String?) ?? '';
      final lc = (g['lcNumber'] as String?) ?? '';
      final q = (s) => s.toLowerCase();

      if (_filterZone.isNotEmpty && q(zone) != q(_filterZone)) return false;
      if (_filterDivision.isNotEmpty && q(division) != q(_filterDivision)) return false;
      if (_filterLocation.isNotEmpty && !q(location).contains(q(_filterLocation))) return false;
      if (_filterName.isNotEmpty && !q(name).contains(q(_filterName))) return false;
      if (_filterLc.isNotEmpty && !q(lc).contains(q(_filterLc))) return false;
      return true;
    }).toList();

    int cmp(DateTime a, DateTime b) => b.compareTo(a);
    filtered.sort((a, b) {
      switch (_sortBy) {
        case 'name_asc':
          return ((a['name'] as String?) ?? '').compareTo((b['name'] as String?) ?? '');
        case 'name_desc':
          return ((b['name'] as String?) ?? '').compareTo((a['name'] as String?) ?? '');
        case 'lc_asc':
          return ((a['lcNumber'] as String?) ?? '').compareTo((b['lcNumber'] as String?) ?? '');
        case 'zone_asc':
          return ((a['zone'] as String?) ?? '').compareTo((b['zone'] as String?) ?? '');
        case 'location_asc':
          return ((a['locationName'] as String?) ?? '').compareTo((b['locationName'] as String?) ?? '');
        case 'newest':
        default:
          return cmp(
            DateTime.tryParse((a['createdAt'] as String?) ?? '') ?? DateTime(0),
            DateTime.tryParse((b['createdAt'] as String?) ?? '') ?? DateTime(0),
          );
      }
    });
    return filtered;
  }

  void _resetFilters() {
    setState(() {
      _filterZone = '';
      _filterDivision = '';
      _filterLocation = '';
      _filterName = '';
      _filterLc = '';
      _sortBy = 'newest';
    });
  }

  void _openFilterSheet() {
    String zone = _filterZone;
    String division = _filterDivision;
    String sort = _sortBy;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final divisions = zone.isNotEmpty ? (_divisionsByZone[zone] ?? <String>[]) : <String>[];
          final locCtrl = TextEditingController(text: _filterLocation);
          final nameCtrl = TextEditingController(text: _filterName);
          final lcCtrl = TextEditingController(text: _filterLc);
          final bottomInset = MediaQuery.of(sheetContext).viewInsets.bottom;
          final bottomPadding = MediaQuery.of(sheetContext).padding.bottom;
          return SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 14,
                bottom: bottomInset > 0 ? bottomInset + 16 : (bottomPadding > 0 ? bottomPadding + 16 : 24),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Filter & Sort',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        TextButton(
                          onPressed: () {
                            setSheetState(() {
                              zone = '';
                              division = '';
                              sort = 'newest';
                              locCtrl.clear();
                              nameCtrl.clear();
                              lcCtrl.clear();
                            });
                          },
                          child: const Text('Reset'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: zone.isEmpty ? null : zone,
                      decoration: const InputDecoration(labelText: 'Zone'),
                      items: _zones
                          .map((z) => DropdownMenuItem(value: z, child: Text(z, overflow: TextOverflow.ellipsis)))
                          .toList(),
                      onChanged: (val) => setSheetState(() {
                        zone = val ?? '';
                        division = ''; // reset division when zone changes
                      }),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: division.isEmpty ? null : division,
                      decoration: const InputDecoration(labelText: 'Division'),
                      items: divisions
                          .map((d) => DropdownMenuItem(value: d, child: Text(d, overflow: TextOverflow.ellipsis)))
                          .toList(),
                      onChanged: zone.isEmpty ? null : (val) => setSheetState(() => division = val ?? ''),
                      hint: Text(zone.isEmpty ? 'Select Zone first…' : 'Select Division…'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: locCtrl,
                      decoration: const InputDecoration(labelText: 'Location', prefixIcon: Icon(Icons.location_city)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Gate Name', prefixIcon: Icon(Icons.label)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: lcCtrl,
                      decoration: const InputDecoration(labelText: 'LC Number', prefixIcon: Icon(Icons.numbers), hintText: 'e.g. LC-0001'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: sort,
                      decoration: const InputDecoration(labelText: 'Sort By'),
                      items: _sortOptions
                          .map((o) => DropdownMenuItem(value: o['value'], child: Text(o['label']!)))
                          .toList(),
                      onChanged: (val) => setSheetState(() => sort = val ?? 'newest'),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _filterZone = zone;
                          _filterDivision = division;
                          _filterLocation = locCtrl.text;
                          _filterName = nameCtrl.text;
                          _filterLc = lcCtrl.text;
                          _sortBy = sort;
                        });
                        Navigator.pop(sheetContext);
                      },
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Apply Filters', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _deleteGate(Map gate) async {
    final ctrl = TextEditingController();
    bool confirm = await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Are you absolutely sure?', style: TextStyle(color: Colors.red)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('This action cannot be undone. It will permanently delete this LC Gate and all associated Master units, Slave devices, and photographic evidence.'),
            const SizedBox(height: 16),
            Text('Please type "${gate['name'] ?? gate['lcNumber']}" to confirm:'),
            const SizedBox(height: 8),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(border: OutlineInputBorder()),
            )
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              if (ctrl.text == (gate['name'] ?? gate['lcNumber'])) {
                Navigator.pop(context, true);
              } else {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name does not match')));
              }
            }, 
            child: const Text('Delete this gate', style: TextStyle(color: Colors.white))
          ),
        ],
      )
    ) ?? false;

    if (!confirm) return;

    setState(() => _isLoading = true);
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl/lcgate/${gate['id']}'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 204) {
        _fetchGates();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to delete')));
        setState(() => _isLoading = false);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _visibleGates;

    return Scaffold(
      appBar: AppBar(
        title: const Text('LC Gates & Clusters', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        backgroundColor: Colors.transparent,
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _hasActiveFilters,
              child: const Icon(Icons.filter_list),
            ),
            tooltip: 'Filter & Sort',
            onPressed: _openFilterSheet,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Create Gate'),
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CreateGateScreen(token: _token),
            ),
          );
          if (result == true) _fetchGates();
        },
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Theme.of(context).primaryColor.withOpacity(0.05), Colors.white],
          ),
        ),
        child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _gates.isEmpty
              ? const Center(child: Text('No LC Gates found. Create one!', style: TextStyle(color: Colors.grey, fontSize: 16)))
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.search_off, size: 48, color: Colors.grey),
                          const SizedBox(height: 12),
                          const Text('No gates match the current filters.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                          const SizedBox(height: 12),
                          OutlinedButton(onPressed: _resetFilters, child: const Text('Clear Filters')),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final gate = filtered[index];
                        final masters = gate['masters'] as List? ?? [];
                        final deviceCount = masters.fold<int>(0, (sum, m) => sum + ((m['childDevices'] as List?)?.length ?? 0));
                        final zone = (gate['zone'] as String?) ?? '';
                        final division = (gate['division'] as String?) ?? '';

                        return Card(
                          elevation: 4,
                          margin: const EdgeInsets.only(bottom: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () async {
                              final result = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => GateDetailScreen(token: _token, gate: gate),
                                ),
                              );
                              if (result == true) _fetchGates();
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(gate['locationName'] ?? 'Unknown', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                                            if (gate['name'] != null && gate['name'].isNotEmpty)
                                              Text(gate['name'], style: const TextStyle(color: Colors.grey, fontSize: 14)),
                                          ],
                                        ),
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Container(
                                            decoration: BoxDecoration(
                                              color: Colors.red.withOpacity(0.1),
                                              shape: BoxShape.circle,
                                            ),
                                            child: IconButton(
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                                              icon: const Icon(Icons.delete_outline, color: Colors.red, size: 22),
                                              onPressed: () => _deleteGate(gate),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          Chip(
                                            label: Text('${gate['lcNumber'] ?? ''}', style: const TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold)),
                                            backgroundColor: Colors.indigo.withOpacity(0.1),
                                            side: BorderSide.none,
                                          )
                                        ],
                                      )
                                    ],
                                  ),
                                  if (zone.isNotEmpty || division.isNotEmpty) ...[
                                    const SizedBox(height: 10),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      children: [
                                        if (zone.isNotEmpty)
                                          Chip(
                                            label: Text(zone, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                                            backgroundColor: Colors.indigo,
                                            side: BorderSide.none,
                                            visualDensity: VisualDensity.compact,
                                          ),
                                        if (division.isNotEmpty)
                                          Chip(
                                            label: Text(division, style: const TextStyle(color: Color(0xFF0E9AA7), fontSize: 12, fontWeight: FontWeight.w600)),
                                            backgroundColor: const Color(0xFF0E9AA7).withOpacity(0.1),
                                            side: BorderSide.none,
                                            visualDensity: VisualDensity.compact,
                                          ),
                                      ],
                                    ),
                                  ],
                                  const SizedBox(height: 16),
                                  const Divider(height: 1),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      _buildStat(masters.length.toString(), 'MASTERS'),
                                      const SizedBox(width: 32),
                                      _buildStat(deviceCount.toString(), 'DEVICES'),
                                    ],
                                  )
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

  Widget _buildStat(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.indigo)),
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 1.2)),
      ],
    );
  }
}