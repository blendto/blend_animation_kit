import 'package:custom_text_animations/src/text_animation_builder/text_animation_builder.dart';
import 'package:flutter/material.dart';

Widget variant1(String text, TextStyle? textStyle) => TextAnimationBuilder(
        text: text, textStyle: textStyle, breakType: BreakType.character)
    .opacity(
      initialOpacity: 0.0,
      speed: const Duration(milliseconds: 950),
      stepInterval: const Duration(milliseconds: 70),
      curve: Curves.easeOutExpo,
      finalOpacity: 1.0,
    )
    .transform(
      initialMatrix: Matrix4.identity()..scale(4.0),
      speed: const Duration(milliseconds: 950),
      stepInterval: const Duration(milliseconds: 70),
      curve: Curves.easeOutExpo,
      finalMatrix: Matrix4.identity(),
    )
    .wait()
    .delay(const Duration(seconds: 1))
    .opacity(
      initialOpacity: 1.0,
      speed: const Duration(seconds: 1),
      stepInterval: Duration.zero,
      curve: Curves.easeOutExpo,
      finalOpacity: 0.0,
    )
    .generateWidget();

Widget variant2(String text, TextStyle? textStyle) => TextAnimationBuilder(
        text: text, textStyle: textStyle, breakType: BreakType.character)
    .opacity(
      initialOpacity: 0.0,
      speed: const Duration(milliseconds: 2250),
      stepInterval: const Duration(milliseconds: 150),
      curve: Curves.easeInOutQuad,
      finalOpacity: 1.0,
    )
    .wait()
    .delay(const Duration(seconds: 1))
    .opacity(
      initialOpacity: 1.0,
      speed: const Duration(seconds: 1),
      stepInterval: Duration.zero,
      curve: Curves.easeInOutQuad,
      finalOpacity: 0.0,
    )
    .generateWidget();
