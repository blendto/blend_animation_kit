import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';

class WidgetEffectsDemo extends StatefulWidget {
  const WidgetEffectsDemo({super.key, required this.title});

  final String title;

  @override
  State<WidgetEffectsDemo> createState() => _WidgetEffectsDemoState();
}

class _WidgetEffectsDemoState extends State<WidgetEffectsDemo> {
  @override
  Widget build(BuildContext context) {
    final builder = WidgetAnimationBuilder(
      WidgetAnimationInput(widget: const SampleIcon()),
    );
    return SafeArea(
      child: Stack(children: [
        AnimationWidget(builder: builder, boxSize: const Size(200, 200)),
      ]),
    );
  }
}

class SampleIcon extends StatelessWidget {
  const SampleIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 200,
      child: Container(
        color: Colors.blue,
        child: const Icon(
          Icons.favorite,
          color: Colors.white,
          size: 200.0,
        ),
      ),
    );
  }
}
