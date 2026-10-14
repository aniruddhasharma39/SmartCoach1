import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'create_master_screen.dart';
import 'evidence_checklist_screen.dart';
import '../../config.dart';
import '../../utils/app_feedback.dart';

class GateDetailScreen extends StatefulWidget {
  final String token;
  final Map gate;

  const GateDetailScreen({super.key, required this.token, required this.gate});

  @override
  State<GateDetailScreen> createState() => _GateDetailScreenState();
}

class _GateDetailScreenState extends State<GateDetailScreen> {
  late Map gate;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    gate = widget.gate;
  }

  Future<void> _refresh({bool isManual = false}) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/lcgate'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        final List data = json.decode(res.body);
        final updated = data.firstWhere((g) => g['id'] == gate['id'], orElse: () => gate);
        if (mounted) {
          setState(() => gate = updated);
          if (isManual) {
            AppFeedback.showSuccess(context, 'Gate and device details refreshed.');
          }
        }
      } else {
        if (mounted && isManual) {
          AppFeedback.showError(context, 'Failed to refresh gate details (HTTP ${res.statusCode}).');
        }
      }
    } catch (e) {
      if (mounted && isManual) {
        AppFeedback.showError(context, 'Network error refreshing gate details: $e');
      }
    }
  }

  Future<void> _deleteMaster(Map master) async {
    final ctrl = TextEditingController();
    final serial = (master['serialNumber'] ?? '').toString();
    bool confirm = await showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Delete Master Unit?', style: TextStyle(color: Colors.red)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('This action cannot be undone. This will permanently delete the Master Unit, and all of its Slave Devices and evidence.'),
            const SizedBox(height: 16),
            Text('Please type "$serial" to confirm:'),
            const SizedBox(height: 8),
            TextField(controller: ctrl, decoration: const InputDecoration(border: OutlineInputBorder()))
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              if (ctrl.text.trim() == serial) {
                Navigator.pop(dialogCtx, true);
              } else {
                AppFeedback.showWarning(context, 'Serial number does not match "$serial". Deletion aborted.');
              }
            }, 
            child: const Text('Delete Master Unit', style: TextStyle(color: Colors.white))
          ),
        ],
      )
    ) ?? false;

    if (!confirm) return;
    setState(() => _isLoading = true);
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl/lcgate/masters/${master['id']}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 204 || res.statusCode == 200) {
        await _refresh();
        if (mounted) {
          AppFeedback.showSuccess(context, 'Master Unit "$serial" permanently deleted.');
        }
      } else {
        String errMsg = 'Failed to delete Master Unit';
        try {
          final err = json.decode(res.body);
          if (err['error'] != null) errMsg = err['error'];
        } catch (_) {}
        if (mounted) {
          AppFeedback.showError(context, errMsg);
        }
      }
    } catch (e) {
      if (mounted) {
        AppFeedback.showError(context, 'Network error deleting Master Unit: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteDevice(Map device) async {
    final serial = (device['serialNumber'] ?? 'Unknown').toString();
    final deviceTypeName = device['type'] == 'DEVICE_1' ? 'Device 1 (Hall Effect + Limit Switch)' : 'Device 2 (Tilt Sensor)';
    bool confirm = await showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text('Delete Slave Device "$serial"?'),
        content: Text('Are you sure you want to permanently delete this $deviceTypeName?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(dialogCtx, true), 
            child: const Text('Delete', style: TextStyle(color: Colors.white))
          ),
        ],
      )
    ) ?? false;

    if (!confirm) return;
    setState(() => _isLoading = true);
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl/lcgate/devices/${device['id']}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 204 || res.statusCode == 200) {
        await _refresh();
        if (mounted) {
          AppFeedback.showSuccess(context, 'Slave Device "$serial" deleted successfully.');
        }
      } else {
        String errMsg = 'Failed to delete slave device';
        try {
          final err = json.decode(res.body);
          if (err['error'] != null) errMsg = err['error'];
        } catch (_) {}
        if (mounted) {
          AppFeedback.showError(context, errMsg);
        }
      }
    } catch (e) {
      if (mounted) {
        AppFeedback.showError(context, 'Network error deleting slave device: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _addSlaveDevice(Map master) async {
    int calcLocalSeq(String type) {
      final devices = (master['childDevices'] as List? ?? [])
          .where((d) => d['type'] == type)
          .toList();
      final taken = devices.map((d) => d['deviceSequence'] as int? ?? 0).toSet();
      int next = 1;
      while (taken.contains(next)) {
        next++;
      }
      return next;
    }

    String selectedType = 'DEVICE_1';
    final seqCtrl = TextEditingController(
      text: calcLocalSeq('DEVICE_1').toString().padLeft(2, '0'),
    );
    bool isSyncing = false;

    Future<void> fetchSeq(String type, void Function(void Function()) setDialogState) async {
      try {
        final res = await http.get(
          Uri.parse('$baseUrl/lcgate/masters/${master['id']}/next-device-sequence?type=$type'),
          headers: {'Authorization': 'Bearer ${widget.token}'},
        ).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final data = json.decode(res.body);
          if (data['nextSequence'] != null && selectedType == type) {
            setDialogState(() {
              seqCtrl.text = data['nextSequence'].toString().padLeft(2, '0');
              isSyncing = false;
            });
            return;
          }
        }
      } catch (_) {}
      if (selectedType == type) {
        setDialogState(() => isSyncing = false);
      }
    }

    // Immediately show dialog without waiting for blocking network request!
    bool? add = await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Add Slave Device'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile(
                title: const Text('Device 1'),
                subtitle: const Text('Hall Effect + Limit Switch'),
                value: 'DEVICE_1',
                groupValue: selectedType,
                onChanged: (val) {
                  final newType = val.toString();
                  final nextLocal = calcLocalSeq(newType);
                  setDialogState(() {
                    selectedType = newType;
                    seqCtrl.text = nextLocal.toString().padLeft(2, '0');
                    isSyncing = true;
                  });
                  fetchSeq(newType, setDialogState);
                },
              ),
              RadioListTile(
                title: const Text('Device 2'),
                subtitle: const Text('Tilt Sensor'),
                value: 'DEVICE_2',
                groupValue: selectedType,
                onChanged: (val) {
                  final newType = val.toString();
                  final nextLocal = calcLocalSeq(newType);
                  setDialogState(() {
                    selectedType = newType;
                    seqCtrl.text = nextLocal.toString().padLeft(2, '0');
                    isSyncing = true;
                  });
                  fetchSeq(newType, setDialogState);
                },
              ),
              const SizedBox(height: 16),
              TextField(
                controller: seqCtrl,
                readOnly: true,
                decoration: InputDecoration(
                  labelText: 'Device Sequence (2 Digits) *',
                  prefixText: '${master['serialNumber']}-${selectedType == 'DEVICE_1' ? 'A' : 'B'}',
                  prefixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo),
                  suffixIcon: isSyncing
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
              )
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: (isSyncing || seqCtrl.text.isEmpty)
                  ? null
                  : () => Navigator.pop(context, true),
              child: const Text('Add Device'),
            ),
          ],
        ),
      ),
    );

    if (add == true) {
      setState(() => _isLoading = true);
      try {
        final res = await http.post(
          Uri.parse('$baseUrl/lcgate/masters/${master['id']}/devices'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
          body: json.encode({
            'type': selectedType,
            'deviceSequence': int.tryParse(seqCtrl.text) ?? calcLocalSeq(selectedType),
          }),
        );
        if (res.statusCode == 201) {
          await _refresh();
          if (mounted) {
            final typeLabel = selectedType == 'DEVICE_1' ? 'Device 1 (Hall Effect)' : 'Device 2 (Tilt Sensor)';
            AppFeedback.showSuccess(
              context,
              'Slave device $typeLabel added successfully!',
            );
          }
        } else {
          String err = 'Failed to add slave device';
          try {
            final body = json.decode(res.body);
            if (body['error'] != null) err = body['error'];
          } catch (_) {}
          if (mounted) {
            AppFeedback.showError(context, err);
          }
        }
      } catch (e) {
        if (mounted) {
          AppFeedback.showError(context, 'Network error adding slave device: $e');
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    List masters = gate['masters'] ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(gate['name'] ?? 'Gate Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Gate Details',
            onPressed: () => _refresh(isManual: true),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.push(context, MaterialPageRoute(
            builder: (_) => CreateMasterScreen(token: widget.token, gate: gate)
          ));
          if (!context.mounted) return;
          if (result == true) {
            await _refresh();
            if (!context.mounted) return;
            AppFeedback.showSuccess(context, 'New Master Unit created and linked to this gate.');
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Add Master'),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: () => _refresh(isManual: true),
            child: masters.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 120),
                    Center(child: Text('No Master Units assigned', style: TextStyle(color: Colors.grey, fontSize: 16))),
                  ],
                )
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: masters.length,
                  itemBuilder: (context, index) {
                    final master = masters[index];
                    final List devices = master['childDevices'] ?? [];
                    
                    return Card(
                      margin: const EdgeInsets.only(bottom: 24),
                      elevation: 4,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(master['serialNumber'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                                Row(
                                  children: [
                                    Container(
                                      decoration: BoxDecoration(
                                        color: Colors.red.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: IconButton(
                                        icon: const Icon(Icons.delete_outline, color: Colors.red),
                                        onPressed: () => _deleteMaster(master),
                                        constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                                        padding: EdgeInsets.zero,
                                      ),
                                    )
                                  ],
                                )
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('Power Source: ${master['powerSource'] == 'SOLAR' ? '☀️ Solar Power' : '🔌 Direct Current'}', style: const TextStyle(color: Colors.grey)),
                            const SizedBox(height: 16),
                            
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.grey.shade50,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey.shade200)
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('Slave Devices', style: TextStyle(fontWeight: FontWeight.bold)),
                                        TextButton.icon(
                                          icon: const Icon(Icons.add, size: 16),
                                          label: const Text('Add Slave'),
                                          onPressed: () => _addSlaveDevice(master),
                                          style: TextButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                          ),
                                        )
                                      ],
                                    ),
                                  ),
                                  const Divider(height: 1),
                                  if (devices.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: Text('No slave devices added yet.', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic)),
                                    )
                                  else
                                    ...devices.map((device) => ListTile(
                                      leading: const Icon(Icons.electrical_services, color: Colors.blueGrey),
                                      title: Text(device['serialNumber'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold)),
                                      subtitle: Text(device['type'] == 'DEVICE_1' ? 'Hall Effect + Limit Switch' : 'Tilt Sensor'),
                                      trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Chip(label: Text(device['type'] == 'DEVICE_1' ? 'A' : 'B'), padding: EdgeInsets.zero),
                                          Container(
                                            decoration: BoxDecoration(
                                              color: Colors.red.withOpacity(0.1),
                                              shape: BoxShape.circle,
                                            ),
                                            child: IconButton(
                                              icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                              onPressed: () => _deleteDevice(device),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                            ),
                                          )
                                        ],
                                      ),
                                      dense: true,
                                    )),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.checklist),
                                label: const Text('Upload Evidence Checklist'),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  side: const BorderSide(color: Colors.blue),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () async {
                                  await Navigator.push(context, MaterialPageRoute(
                                    builder: (_) => EvidenceChecklistScreen(
                                      token: widget.token,
                                      master: master,
                                    )
                                  ));
                                  if (!context.mounted) return;
                                  await _refresh();
                                  if (!context.mounted) return;
                                  AppFeedback.showInfo(context, 'Evidence checklist status updated.');
                                },
                              ),
                            )
                          ],
                        ),
                      ),
                    );
                  },
                ),
          ),
    );
  }
}
