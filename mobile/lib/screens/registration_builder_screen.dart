import 'package:flutter/material.dart';
import '../main.dart';
import '../utils/app_feedback.dart';

class RegistrationBuilderScreen extends StatelessWidget {
  final Map<String, dynamic> user;
  const RegistrationBuilderScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.build, size: 64, color: AppColors.primary),
          const SizedBox(height: 16),
          const Text('Registration Builder', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 32.0),
            child: Text(
              'The advanced drag-and-drop Registration Form Builder is designed for desktop web. Please use the Web Developer Console to design your custom registration pipelines.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 16),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () {
              AppFeedback.showInfo(
                context,
                'Form Schema Builder is active on the Web Developer Console.',
              );
            },
            icon: const Icon(Icons.info_outline),
            label: const Text('Builder Information'),
          ),
        ],
      ),
    );
  }
}
