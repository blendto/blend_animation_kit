import 'package:custom_text_animations/src/text_animation_builder/text_animation_builder.dart';
import 'package:flutter/material.dart';

Widget variant2(String text, TextStyle? textStyle) =>
    CharacterAnimationBuilder(text: text, textStyle: textStyle)
        .opacity(
          initialOpacity: 0.0,
          characterAnimationSpeed: const Duration(milliseconds: 2250),
          characterDelay: (index) => Duration(milliseconds: 150 * (index)),
          curve: Curves.easeInOutQuad,
          finalOpacity: 1.0,
        )
        .wait()
        .delay(const Duration(seconds: 5))
        .opacity(
          initialOpacity: 1.0,
          characterAnimationSpeed: const Duration(seconds: 1),
          characterDelay: (index) => Duration.zero,
          curve: Curves.easeInOutQuad,
          finalOpacity: 0.0,
        )
        .generateWidget();
