import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:custom_text_animations/custom_text_animations.dart';
import 'package:flutter/material.dart';

abstract class TextAnimationWidget extends StatelessWidget {
  final String text;
  final bool loop;
  final TextStyle? textStyle;

  const TextAnimationWidget({
    super.key,
    required this.text,
    this.loop = true,
    this.textStyle,
  });

  List<AnimatedText> get animations;

  @override
  Widget build(BuildContext context) {
    return AnimatedTextKit(
      animatedTexts: animations,
      pause: Duration.zero,
      repeatForever: loop,
    );
  }
}
