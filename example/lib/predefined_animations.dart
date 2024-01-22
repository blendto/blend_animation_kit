import 'dart:math';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';

final PipelineStep variant2Pipeline = const RectangularMaskStep(
      initialFractionalEdgeInsets: EdgeInsets.fromLTRB(1, 1, 0, 0),
      stepDuration: Duration(seconds: 1),
    ) +
    PipelineHelpers.waitAndFadeOutAll();

Widget variant2(String text, TextStyle? textStyle) => BlendAnimationWidget(
    builder: BlendAnimationBuilder(CharacterAnimationInput(
            text: text, textStyle: textStyle, textAlign: TextAlign.end))
        .add(variant2Pipeline));

final PipelineStep variant3Pipeline = PipelineHelpers.opacityAndTransform(
      initialOpacity: 1.0,
      initialMatrix: Matrix4.identity()..scale(0.001),
      finalOpacity: 1.0,
      finalMatrix: Matrix4.identity(),
      transformAlignment: Alignment.bottomLeft,
      stepDuration: const Duration(milliseconds: 1500),
      interStepDelay: const Duration(milliseconds: 45),
      curve: Curves.elasticOut,
    ) +
    PipelineHelpers.waitAndFadeOutAll();

Widget variant3(String text, TextStyle? textStyle) => BlendAnimationWidget(
    builder: BlendAnimationBuilder(
            CharacterAnimationInput(text: text, textStyle: textStyle))
        .add(variant3Pipeline));

final PipelineStep variant4Pipeline = PipelineHelpers.opacityAndTransform(
      initialOpacity: 0.0,
      initialMatrix: Matrix4.identity()..translate(0.0, 15.0),
      finalOpacity: 1.0,
      finalMatrix: Matrix4.identity(),
      stepDuration: const Duration(milliseconds: 1000),
      interStepDelay: const Duration(milliseconds: 100),
      curve: Curves.elasticOut,
    ) +
    PipelineHelpers.waitAndFadeOutAll();

Widget variant4(String text, TextStyle? textStyle) => BlendAnimationWidget(
    builder: BlendAnimationBuilder(
            CharacterAnimationInput(text: text, textStyle: textStyle))
        .add(variant4Pipeline));

final PipelineStep variant5Pipeline = PipelineHelpers.opacityAndTransform(
      initialOpacity: 0.0,
      finalOpacity: 1.0,
      initialMatrix: Matrix4.identity()..rotateY(-pi / 2),
      finalMatrix: Matrix4.identity(),
      stepDuration: const Duration(milliseconds: 1300),
      interStepDelay: const Duration(milliseconds: 45),
      curve: Curves.easeOutExpo,
    ) +
    PipelineHelpers.waitAndFadeOutAll();

Widget variant5(String text, TextStyle? textStyle) => BlendAnimationWidget(
    builder: BlendAnimationBuilder(
            CharacterAnimationInput(text: text, textStyle: textStyle))
        .add(variant5Pipeline));

final PipelineStep variant6Pipeline = PipelineHelpers.opacityAndTransform(
      initialOpacity: 0.0,
      finalOpacity: 1.0,
      initialMatrix: Matrix4.identity()..translate(80.0),
      finalMatrix: Matrix4.identity(),
      stepDuration: const Duration(milliseconds: 2000),
      interStepDelay: const Duration(milliseconds: 30),
      curve: Curves.easeOutExpo,
    ) +
    PipelineHelpers.waitAndFadeOutAll();

Widget variant6(String text, TextStyle? textStyle) => BlendAnimationWidget(
    builder: BlendAnimationBuilder(
            CharacterAnimationInput(text: text, textStyle: textStyle))
        .add(variant6Pipeline));
