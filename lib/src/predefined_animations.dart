import 'dart:math';

import 'package:blend_animation_kit/src/animation_input.dart';
import 'package:blend_animation_kit/src/pipeline/opacity.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_helpers.dart';
import 'package:blend_animation_kit/src/text_animation_widget.dart';
import 'package:flutter/material.dart';

final variant2Pipeline = OpacityStep(
  initialOpacity: 0.0,
  stepDuration: const Duration(milliseconds: 2250),
  interStepDelay: const Duration(milliseconds: 150),
  curve: Curves.easeInOutQuad,
  finalOpacity: 1.0,
).chain(PipelineHelpers.waitAndFadeOutAll());

Widget variant2(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant2Pipeline,
    );

final variant3Pipeline = PipelineHelpers.opacityAndTransform(
  initialOpacity: 1.0,
  initialMatrix: Matrix4.identity()..scale(0.001),
  finalOpacity: 1.0,
  finalMatrix: Matrix4.identity(),
  transformAlignment: Alignment.bottomLeft,
  stepDuration: const Duration(milliseconds: 1500),
  interStepDelay: const Duration(milliseconds: 45),
  curve: Curves.elasticOut,
).chain(PipelineHelpers.waitAndFadeOutAll());

Widget variant3(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant3Pipeline,
    );

final variant4Pipeline = PipelineHelpers.opacityAndTransform(
  initialOpacity: 0.0,
  initialMatrix: Matrix4.identity()..translate(0.0, 15.0),
  finalOpacity: 1.0,
  finalMatrix: Matrix4.identity(),
  stepDuration: const Duration(milliseconds: 1000),
  interStepDelay: const Duration(milliseconds: 100),
  curve: Curves.elasticOut,
).chain(PipelineHelpers.waitAndFadeOutAll());

Widget variant4(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant4Pipeline,
    );

final variant5Pipeline = PipelineHelpers.opacityAndTransform(
  initialOpacity: 0.0,
  finalOpacity: 1.0,
  initialMatrix: Matrix4.identity()..rotateY(-pi / 2),
  finalMatrix: Matrix4.identity(),
  stepDuration: const Duration(milliseconds: 1300),
  interStepDelay: const Duration(milliseconds: 45),
  curve: Curves.easeOutExpo,
).chain(PipelineHelpers.waitAndFadeOutAll());

Widget variant5(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant5Pipeline,
    );

final variant6Pipeline = PipelineHelpers.opacityAndTransform(
  initialOpacity: 0.0,
  finalOpacity: 1.0,
  initialMatrix: Matrix4.identity()..translate(80.0),
  finalMatrix: Matrix4.identity(),
  stepDuration: const Duration(milliseconds: 2000),
  interStepDelay: const Duration(milliseconds: 30),
  curve: Curves.easeOutExpo,
).chain(PipelineHelpers.waitAndFadeOutAll());

Widget variant6(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant6Pipeline,
    );
