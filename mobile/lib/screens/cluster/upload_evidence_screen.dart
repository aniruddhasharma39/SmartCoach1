import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' as io;
import '../../config.dart';

class UploadEvidenceScreen extends StatefulWidget {
  final String token;
  final int masterId;
  final int? childDeviceId;
  final String category; // 'MASTER', 'DEVICE_1', 'DEVICE_2', 'POWER_SOURCE'
  final String targetName; // e.g., 'Master 123'

  const UploadEvidenceScreen({
    super.key,
    required this.token,
    required this.masterId,
    this.childDeviceId,
    required this.category,
    required this.targetName,
  });

  @override
  State<UploadEvidenceScreen> createState() => _UploadEvidenceScreenState();
}

class _UploadEvidenceScreenState extends State<UploadEvidenceScreen> {
  XFile? _image;
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = false;
  double _uploadProgress = 0.0;
  String _progressStatus = '';
  String _sourceLabel = 'Camera';
  Timer? _progressTimer;

  @override
  void dispose() {
    _progressTimer?.cancel();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final XFile? photo = await _picker.pickImage(source: source, imageQuality: 70);
    if (photo != null) {
      setState(() {
        _image = photo;
        _sourceLabel = source == ImageSource.camera ? 'Camera' : 'Gallery';
      });
    }
  }

  void _showSourceOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(context);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _upload() async {
    if (_image == null) return;
    setState(() {
      _isLoading = true;
      _uploadProgress = 0.15;
      _progressStatus = 'Getting GPS location...';
    });

    try {
      // Step 1: Get Location
      Position? position;
      try {
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }
          if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
            position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
          }
        }
      } catch (e) {
        print('Could not fetch location: $e');
      }

      // Step 2: Read image to base64
      setState(() {
        _uploadProgress = 0.40;
        _progressStatus = 'Preparing and optimizing photo...';
      });

      final bytes = await _image!.readAsBytes();
      final base64Image = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      // Step 3: Preparing payload & starting upload
      setState(() {
        _uploadProgress = 0.60;
        _progressStatus = 'Uploading photo to server...';
      });

      final body = <String, dynamic>{
        'masterId': widget.masterId,
        'category': widget.category,
        'imageBase64': base64Image,
        'latitude': position?.latitude,
        'longitude': position?.longitude,
      };
      if (widget.childDeviceId != null) {
        body['childDeviceId'] = widget.childDeviceId;
      }

      // Smooth progress ticker while awaiting network
      _progressTimer?.cancel();
      _progressTimer = Timer.periodic(const Duration(milliseconds: 250), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() {
          if (_uploadProgress < 0.92) {
            _uploadProgress += 0.04;
          }
        });
      });

      final res = await http.post(
        Uri.parse('$baseUrl/evidence'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: json.encode(body),
      );

      _progressTimer?.cancel();

      if (res.statusCode == 201) {
        setState(() {
          _uploadProgress = 1.0;
          _progressStatus = 'Upload complete!';
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Uploaded successfully!')));
        }
        await Future.delayed(const Duration(milliseconds: 300));
        if (mounted) {
          Navigator.pop(context, json.decode(res.body));
        }
      } else {
        throw Exception(res.body);
      }
    } catch (e) {
      _progressTimer?.cancel();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      _progressTimer?.cancel();
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Upload Photo: ${widget.targetName}')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_image != null) ...[
                kIsWeb ? Image.network(_image!.path, height: 300) : Image.file(io.File(_image!.path), height: 300),
                const SizedBox(height: 16),
                Text('Source: $_sourceLabel', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                const SizedBox(height: 24),
              ],
              ElevatedButton.icon(
                icon: const Icon(Icons.add_a_photo),
                label: const Text('Choose Photo'),
                onPressed: _isLoading ? null : _showSourceOptions,
                style: ElevatedButton.styleFrom(minimumSize: const Size(200, 50)),
              ),
              const SizedBox(height: 20),

              // Visual Progress Bar when uploading
              if (_isLoading) ...[
                Container(
                  constraints: const BoxConstraints(maxWidth: 360),
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              _progressStatus,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.blue.shade900),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '${(_uploadProgress * 100).toInt()}%',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.blue.shade900),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: _uploadProgress.clamp(0.0, 1.0),
                          minHeight: 10,
                          backgroundColor: Colors.blue.shade100,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.blue.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (_image != null)
                ElevatedButton.icon(
                  icon: _isLoading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : const Icon(Icons.cloud_upload),
                  label: Text(_isLoading ? 'Uploading (${(_uploadProgress * 100).toInt()}%)...' : 'Upload Evidence'),
                  onPressed: _isLoading ? null : _upload,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    disabledBackgroundColor: Colors.green.shade300,
                    disabledForegroundColor: Colors.white,
                    minimumSize: const Size(220, 50),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}