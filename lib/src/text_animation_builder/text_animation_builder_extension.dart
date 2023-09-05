import 'package:custom_text_animations/src/text_animation_builder/text_animation_builder.dart';
import 'package:flutter/material.dart';

extension TextAnimationBuilderExtension on TextAnimationBuilder {
  TextAnimationBuilder opacityAndTransform({
    required double initialOpacity,
    required double finalOpacity,
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration speed,
    required Duration stepInterval,
    required Curve curve,
    Alignment transformAlignment = Alignment.center,
  }) {
    return opacity(
      initialOpacity: initialOpacity,
      speed: speed,
      stepInterval: stepInterval,
      curve: curve,
      finalOpacity: finalOpacity,
    ).transform(
      initialMatrix: initialMatrix,
      finalMatrix: finalMatrix,
      speed: speed,
      stepInterval: stepInterval,
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
          speed: fadeOutDuration,
          stepInterval: Duration.zero,
          curve: curve,
          finalOpacity: 0.0,
        );
  }
}
