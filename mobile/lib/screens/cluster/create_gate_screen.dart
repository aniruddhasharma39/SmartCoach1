import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import '../../config.dart';
import 'railway_data.dart';

class CreateGateScreen extends StatefulWidget {
  final String token;
  const CreateGateScreen({super.key, required this.token});

  @override
  State<CreateGateScreen> createState() => _CreateGateScreenState();
}

class _CreateGateScreenState extends State<CreateGateScreen> {
  final _locationNameCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _lcNumberCtrl = TextEditingController();
  final _latCtrl = TextEditingController();
  final _lngCtrl = TextEditingController();

  List<String> _zones = RailwayData.zones;
  Map<String, List<String>> _divisionsByZone = RailwayData.data;
  String? _zone;
  String? _division;
  bool _loadingReference = true;

  bool _isLoading = false;
  bool _isFetchingLocation = false;

  @override
  void initState() {
    super.initState();
    _fetchReferenceData();
  }

  Future<void> _fetchReferenceData() async {
    setState(() => _loadingReference = true);
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate/reference-data'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data is Map) {
          final zones = (data['zones'] as List?)?.whereType<String>().toList() ?? [];
          final divisionsRaw = data['divisionsByZone'];
          if (zones.isNotEmpty) {
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
    } finally {
      if (mounted) setState(() => _loadingReference = false);
    }
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isFetchingLocation = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw Exception('Location services are disabled.');

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) throw Exception('Location permissions are denied');
      }
      
      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permissions are permanently denied.');
      } 

      Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _latCtrl.text = position.latitude.toString();
        _lngCtrl.text = position.longitude.toString();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      setState(() => _isFetchingLocation = false);
    }
  }

  Future<void> _submit() async {
    if (_locationNameCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location Name is required')));
      return;
    }
    if (_zone == null || _zone!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a Railway Zone')));
      return;
    }
    if (_division == null || _division!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a Division')));
      return;
    }
    if (_lcNumberCtrl.text.trim().length != 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('LC Number must be exactly 4 digits')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      final lat = double.tryParse(_latCtrl.text);
      final lng = double.tryParse(_lngCtrl.text);
      final body = <String, dynamic>{
        'locationName': _locationNameCtrl.text,
        'name': _nameCtrl.text.isNotEmpty ? _nameCtrl.text : null,
        'lcNumberDigits': _lcNumberCtrl.text,
        'zone': _zone,
        'division': _division,
      };
      if (lat != null) body['latitude'] = lat;
      if (lng != null) body['longitude'] = lng;

      final res = await http.post(
        Uri.parse('$baseUrl/lcgate'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: json.encode(body),
      );

      if (res.statusCode == 201) {
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to create gate: ${res.body}')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final divisions = _zone != null ? (_divisionsByZone[_zone] ?? <String>[]) : <String>[];

    return Scaffold(
      appBar: AppBar(title: const Text('Create LC Gate'), elevation: 0),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Theme.of(context).primaryColor.withOpacity(0.1), Colors.white],
          ),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Card(
            elevation: 4,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Gate Information', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  DropdownButtonFormField<String>(
                    value: _zone,
                    decoration: InputDecoration(
                      labelText: 'Railway Zone *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.map),
                    ),
                    items: _zones.map((z) => DropdownMenuItem(value: z, child: Text(z, overflow: TextOverflow.ellipsis))).toList(),
                    onChanged: _loadingReference ? null : (val) {
                      setState(() {
                        _zone = val;
                        _division = null; // Reset division when zone changes
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _division,
                    decoration: InputDecoration(
                      labelText: 'Division *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.account_tree),
                    ),
                    items: divisions.map((d) => DropdownMenuItem(value: d, child: Text(d, overflow: TextOverflow.ellipsis))).toList(),
                    onChanged: (_zone == null) ? null : (val) {
                      setState(() => _division = val);
                    },
                    hint: Text(_zone == null ? 'Select Zone first…' : 'Select Division…'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _locationNameCtrl, 
                    decoration: InputDecoration(
                      labelText: 'Location Name *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.location_city)
                    )
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _nameCtrl, 
                    decoration: InputDecoration(
                      labelText: 'Gate Name (Optional)',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.label)
                    )
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _lcNumberCtrl, 
                    decoration: InputDecoration(
                      labelText: 'LC Number (4 Digits) *',
                      prefixText: 'LC-',
                      prefixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.numbers)
                    ),
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                  ),
                  const SizedBox(height: 8),
                  const Text('Coordinates', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _latCtrl, 
                          decoration: InputDecoration(
                            labelText: 'Latitude',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ), 
                          keyboardType: TextInputType.number
                        )
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _lngCtrl, 
                          decoration: InputDecoration(
                            labelText: 'Longitude',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ), 
                          keyboardType: TextInputType.number
                        )
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    icon: _isFetchingLocation ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.gps_fixed),
                    label: const Text('Get Current Location'),
                    onPressed: _isFetchingLocation ? null : _getCurrentLocation,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: BorderSide(color: Theme.of(context).primaryColor)
                    ),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isLoading 
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)) 
                      : const Text('Create LC Gate', style: TextStyle(fontSize: 16)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}