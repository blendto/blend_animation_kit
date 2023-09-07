import 'package:blend_animation_kit/src/text_animation_builder.dart';
import 'package:flutter/material.dart';

extension TextAnimationBuilderExtension on TextAnimationBuilder {
  TextAnimationBuilder opacityAndTransform({
    required double initialOpacity,
    required double finalOpacity,
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration stepDuration,
    required Duration interStepDelay,
    required Curve curve,
    Alignment transformAlignment = Alignment.center,
  }) {
    return opacity(
      initialOpacity: initialOpacity,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      finalOpacity: finalOpacity,
    ).transform(
      initialMatrix: initialMatrix,
      finalMatrix: finalMatrix,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      transformAlignment: transformAlignment,
    );
  }

  TextAnimationBuilder waitAndFadeOutAll({
    Duration fadeOutDuration = const Duration(seconds: 1),
    Duration delay = const Duration(seconds: 1),
    Curve curve = Curves.easeInOutQuad,
  }) {
    return wait().delay(delay).opacity(
          initialOpacity: 1.0,
          stepDuration: fadeOutDuration,
          interStepDelay: Duration.zero,
          curve: curve,
          finalOpacity: 0.0,
        );
  }
}
