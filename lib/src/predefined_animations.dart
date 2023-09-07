import 'dart:math';

import 'package:custom_text_animations/src/animation_input.dart';
import 'package:custom_text_animations/src/text_animation_builder.dart';
import 'package:custom_text_animations/src/text_animation_builder_extension.dart';
import 'package:flutter/material.dart';

Widget variant2(String text, TextStyle? textStyle) => TextAnimationBuilder(
        CharacterAnimationInput(text: text, textStyle: textStyle))
    .opacity(
      initialOpacity: 0.0,
      speed: const Duration(milliseconds: 2250),
      stepInterval: const Duration(milliseconds: 150),
      curve: Curves.easeInOutQuad,
      finalOpacity: 1.0,
    )
    .waitAndFadeOutAll()
    .generateWidget();

Widget variant3(String text, TextStyle? textStyle) => TextAnimationBuilder(
        CharacterAnimationInput(text: text, textStyle: textStyle))
    .opacityAndTransform(
      initialOpacity: 1.0,
      initialMatrix: Matrix4.identity()..scale(0.001),
      finalOpacity: 1.0,
      finalMatrix: Matrix4.identity(),
      transformAlignment: Alignment.bottomLeft,
      speed: const Duration(milliseconds: 1500),
      stepInterval: const Duration(milliseconds: 45),
      curve: Curves.elasticOut,
    )
    .waitAndFadeOutAll()
    .generateWidget();

Widget variant4(String text, TextStyle? textStyle) => TextAnimationBuilder(
        CharacterAnimationInput(text: text, textStyle: textStyle))
    .opacityAndTransform(
      initialOpacity: 0.0,
      initialMatrix: Matrix4.identity()..translate(0.0, 15.0),
      finalOpacity: 1.0,
      finalMatrix: Matrix4.identity(),
      speed: const Duration(milliseconds: 1000),
      stepInterval: const Duration(milliseconds: 100),
      curve: Curves.elasticOut,
    )
    .waitAndFadeOutAll()
    .generateWidget();

Widget variant5(String text, TextStyle? textStyle) => TextAnimationBuilder(
        CharacterAnimationInput(text: text, textStyle: textStyle))
    .opacityAndTransform(
      initialOpacity: 0.0,
      finalOpacity: 1.0,
      initialMatrix: Matrix4.identity()..rotateY(-pi / 2),
      finalMatrix: Matrix4.identity(),
      speed: const Duration(milliseconds: 1300),
      stepInterval: const Duration(milliseconds: 45),
      curve: Curves.easeOutExpo,
    )
    .waitAndFadeOutAll()
    .generateWidget();

Widget variant6(String text, TextStyle? textStyle) => TextAnimationBuilder(
        CharacterAnimationInput(text: text, textStyle: textStyle))
    .opacityAndTransform(
      initialOpacity: 0.0,
      finalOpacity: 1.0,
      initialMatrix: Matrix4.identity()..translate(80.0),
      finalMatrix: Matrix4.identity(),
      speed: const Duration(milliseconds: 2000),
      stepInterval: const Duration(milliseconds: 30),
      curve: Curves.easeOutExpo,
    )
    .waitAndFadeOutAll()
    .generateWidget();

Widget variant7(List<String> texts, TextStyle? textStyle) {
  final widgets = <Widget>[];

  Duration delay = Duration.zero;
  final builders = <TextAnimationBuilder>[];
  for (var text in texts) {
    var input = WordAnimationInput(text: text, textStyle: textStyle);
    final builder = TextAnimationBuilder(input)
        .delay(delay)
        .opacityAndTransform(
          initialOpacity: 1.0,
          initialMatrix: Matrix4.identity()..scale(0.001),
          finalOpacity: 1.0,
          finalMatrix: Matrix4.identity(),
          transformAlignment: Alignment.bottomLeft,
          speed: const Duration(milliseconds: 1500),
          stepInterval: const Duration(milliseconds: 45),
          curve: Curves.elasticOut,
        )
        .waitAndFadeOutAll();
    builders.add(builder);
    delay = builder.tween.duration;
  }

  final end = builders.last.tween.duration;

  for (var builder in builders) {
    final widget = builder.delay(end - builder.tween.duration).generateWidget();
    widgets.add(Center(child: widget));
  }

  return Stack(children: widgets);
}
