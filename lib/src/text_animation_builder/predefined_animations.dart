import 'package:custom_text_animations/src/text_animation_builder/text_animation_builder.dart';
import 'package:flutter/material.dart';

Widget variant2(String text, TextStyle? textStyle) => TextAnimationBuilder(
        text: text, textStyle: textStyle, breakType: BreakType.word)
    .opacity(
      initialOpacity: 0.0,
      speed: const Duration(milliseconds: 2250),
      stepInterval: const Duration(milliseconds: 150),
      curve: Curves.easeInOutQuad,
      finalOpacity: 1.0,
    )
    .wait()
    .opacity(
      initialOpacity: 1.0,
      speed: const Duration(seconds: 1),
      stepInterval: Duration.zero,
      curve: Curves.easeInOutQuad,
      finalOpacity: 0.0,
    )
    .generateWidget();
