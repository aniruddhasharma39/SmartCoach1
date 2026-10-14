import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../config.dart';
import '../../main.dart';
import '../../utils/app_feedback.dart';

class CreateMasterScreen extends StatefulWidget {
  final String token;
  final Map gate;

  const CreateMasterScreen({super.key, required this.token, required this.gate});

  @override
  State<CreateMasterScreen> createState() => _CreateMasterScreenState();
}

class _CreateMasterScreenState extends State<CreateMasterScreen> {
  final _seqCtrl = TextEditingController(text: '');
  String _powerSource = 'SOLAR';
  bool _isLoading = false;
  bool _isFetchingSequence = true;
  String? _seqError;

  @override
  void initState() {
    super.initState();
    _fetchSequence();
  }

  @override
  void dispose() {
    _seqCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchSequence({bool isManualRetry = false}) async {
    setState(() {
      _isFetchingSequence = true;
      _seqError = null;
      _seqCtrl.text = '';
    });

    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate/${widget.gate['id']}/next-master-sequence'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['nextSequence'] != null) {
          if (mounted) {
            setState(() {
              _seqCtrl.text = data['nextSequence'].toString().padLeft(2, '0');
              _isFetchingSequence = false;
            });
            if (isManualRetry) {
              AppFeedback.showSuccess(
                context,
                'Master sequence synchronized: Sequence #${data['nextSequence']}',
              );
            }
          }
          return;
        }
      }
      throw Exception('Server returned invalid sequence');
    } catch (e) {
      debugPrint('Error fetching master sequence: $e');
      if (mounted) {
        setState(() {
          _isFetchingSequence = false;
          _seqError = 'Could not load next sequence. Tap to retry.';
        });
        if (isManualRetry) {
          AppFeedback.showError(
            context,
            'Unable to synchronize next master sequence. Please retry.',
          );
        }
      }
    }
  }

  Future<void> _submit() async {
    if (_seqCtrl.text.isEmpty || _isFetchingSequence) {
      AppFeedback.showWarning(context, 'Master sequence is not ready yet. Please wait or retry.');
      return;
    }
    setState(() => _isLoading = true);

    try {
      final res = await http.post(
        Uri.parse('$baseUrl/lcgate/${widget.gate['id']}/masters'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: json.encode({
          'masterSequence': int.tryParse(_seqCtrl.text) ?? 1,
          'powerSource': _powerSource,
        }),
      );

      if (res.statusCode == 201) {
        if (mounted) Navigator.pop(context, true);
      } else {
        String errMsg = 'Failed to create master unit';
        try {
          final body = json.decode(res.body);
          if (body['error'] != null) errMsg = body['error'];
        } catch (_) {}
        if (mounted) {
          AppFeedback.showError(context, errMsg);
        }
      }
    } catch (e) {
      if (mounted) {
        AppFeedback.showError(context, 'Network error creating master unit: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !_isLoading && !_isFetchingSequence && _seqCtrl.text.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Add Master Unit'), elevation: 0),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Theme.of(context).primaryColor.withOpacity(0.08), Colors.white],
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
                  const Text('Master Configuration', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _seqCtrl,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Master Sequence (2 Digits) *',
                      prefixText: _isFetchingSequence || _seqCtrl.text.isEmpty
                          ? null
                          : '${widget.gate['lcNumber']}-',
                      prefixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo),
                      hintText: _isFetchingSequence
                          ? 'Determining next sequence...'
                          : (_seqError ?? 'No sequence available'),
                      hintStyle: TextStyle(
                        color: _seqError != null ? Colors.red.shade400 : Colors.grey.shade500,
                        fontSize: 14,
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.confirmation_number),
                      suffixIcon: _isFetchingSequence
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : (_seqError != null
                              ? IconButton(
                                  icon: const Icon(Icons.refresh, color: AppColors.primary),
                                  tooltip: 'Retry',
                                  onPressed: () => _fetchSequence(isManualRetry: true),
                                )
                              : null),
                    ),
                  ),
                  if (_seqError != null) ...[
                    const SizedBox(height: 6),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, size: 14, color: Colors.red),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              _seqError!,
                              style: TextStyle(fontSize: 12, color: Colors.red.shade700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  const Text('Power Source', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _powerSource,
                    decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.power),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'SOLAR', child: Text('☀️ Solar Power')),
                      DropdownMenuItem(value: 'DIRECT', child: Text('🔌 Direct Current Supply')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _powerSource = val);
                    },
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: canSubmit ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isLoading 
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) 
                      : Text(
                          _isFetchingSequence 
                              ? 'Determining Sequence...' 
                              : 'Create Master Unit',
                          style: const TextStyle(fontSize: 16),
                        ),
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
