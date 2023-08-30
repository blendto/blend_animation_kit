import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:flutter/material.dart';

abstract class TextAnimationWidget extends StatelessWidget {
  final String text;
  final bool loop;
  final TextStyle? textStyle;

  final bool stripNewLine;

  const TextAnimationWidget({
    super.key,
    required this.text,
    this.loop = true,
    this.textStyle,
    this.stripNewLine = true,
  });

  List<AnimatedText> get animations;

  // Size calculateWidgetSize();

  @override
  Widget build(BuildContext context) {
    return AnimatedTextKit(
      animatedTexts: animations,
      pause: Duration.zero,
      repeatForever: loop,
    );
  }
}
