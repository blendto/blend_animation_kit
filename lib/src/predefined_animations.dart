import 'dart:math';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';

final PipelineStep<TextAnimationBuilder> variant2Pipeline =
    const OpacityStep<TextAnimationBuilder>(
          initialOpacity: 0.0,
          stepDuration: Duration(milliseconds: 2250),
          interStepDelay: Duration(milliseconds: 150),
          curve: Curves.easeInOutQuad,
          finalOpacity: 1.0,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

Widget variant2(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant2Pipeline,
    );

final PipelineStep<TextAnimationBuilder> variant3Pipeline =
    PipelineHelpers.opacityAndTransform<TextAnimationBuilder>(
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

Widget variant3(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant3Pipeline,
    );

final PipelineStep<TextAnimationBuilder> variant4Pipeline =
    PipelineHelpers.opacityAndTransform<TextAnimationBuilder>(
          initialOpacity: 0.0,
          initialMatrix: Matrix4.identity()..translate(0.0, 15.0),
          finalOpacity: 1.0,
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 1000),
          interStepDelay: const Duration(milliseconds: 100),
          curve: Curves.elasticOut,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

Widget variant4(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant4Pipeline,
    );

final PipelineStep<TextAnimationBuilder> variant5Pipeline =
    PipelineHelpers.opacityAndTransform<TextAnimationBuilder>(
          initialOpacity: 0.0,
          finalOpacity: 1.0,
          initialMatrix: Matrix4.identity()..rotateY(-pi / 2),
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 1300),
          interStepDelay: const Duration(milliseconds: 45),
          curve: Curves.easeOutExpo,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

Widget variant5(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant5Pipeline,
    );

final PipelineStep<TextAnimationBuilder> variant6Pipeline =
    PipelineHelpers.opacityAndTransform<TextAnimationBuilder>(
          initialOpacity: 0.0,
          finalOpacity: 1.0,
          initialMatrix: Matrix4.identity()..translate(80.0),
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 2000),
          interStepDelay: const Duration(milliseconds: 30),
          curve: Curves.easeOutExpo,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

Widget variant6(String text, TextStyle? textStyle) =>
    TextAnimationWidget.fromInput(
      animationInput: CharacterAnimationInput(text: text),
      textStyle: textStyle,
      pipelineStep: variant6Pipeline,
    );

final PipelineStep<WidgetAnimationBuilder> widgetAnimPipelineVariant2 =
    const OpacityStep<WidgetAnimationBuilder>(
          initialOpacity: 0.0,
          stepDuration: Duration(milliseconds: 2250),
          interStepDelay: Duration(milliseconds: 150),
          curve: Curves.easeInOutQuad,
          finalOpacity: 1.0,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

final PipelineStep<WidgetAnimationBuilder> widgetAnimPipelineVariant3 =
    PipelineHelpers.opacityAndTransform<WidgetAnimationBuilder>(
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

final PipelineStep<WidgetAnimationBuilder> widgetAnimPipelineVariant4 =
    PipelineHelpers.opacityAndTransform<WidgetAnimationBuilder>(
          initialOpacity: 0.0,
          initialMatrix: Matrix4.identity()..translate(0.0, 15.0),
          finalOpacity: 1.0,
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 1000),
          interStepDelay: const Duration(milliseconds: 100),
          curve: Curves.elasticOut,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

final PipelineStep<WidgetAnimationBuilder> widgetAnimPipelineVariant5 =
    PipelineHelpers.opacityAndTransform<WidgetAnimationBuilder>(
          initialOpacity: 0.0,
          finalOpacity: 1.0,
          initialMatrix: Matrix4.identity()..rotateY(-pi / 2),
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 1300),
          interStepDelay: const Duration(milliseconds: 45),
          curve: Curves.easeOutExpo,
        ) +
        PipelineHelpers.waitAndFadeOutAll();

final PipelineStep<WidgetAnimationBuilder> widgetAnimPipelineVariant6 =
    PipelineHelpers.opacityAndTransform<WidgetAnimationBuilder>(
          initialOpacity: 0.0,
          finalOpacity: 1.0,
          initialMatrix: Matrix4.identity()..translate(80.0),
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 2000),
          interStepDelay: const Duration(milliseconds: 30),
          curve: Curves.easeOutExpo,
        ) +
        PipelineHelpers.waitAndFadeOutAll();
