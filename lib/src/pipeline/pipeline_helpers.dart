import 'package:blend_animation_kit/src/base_animation_builder.dart';
import 'package:blend_animation_kit/src/pipeline/delay.dart';
import 'package:blend_animation_kit/src/pipeline/opacity.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/pipeline/transform.dart';
import 'package:blend_animation_kit/src/pipeline/wait.dart';
import 'package:flutter/material.dart';

class PipelineHelpers {
  static PipelineStep<T> waitAndFadeOutAll<T extends AnimationBuilder<T>>({
    Duration fadeOutDuration = const Duration(seconds: 1),
    Duration delay = const Duration(seconds: 1),
    Curve curve = Curves.easeInOutQuad,
  }) {
    return WaitStep<T>() +
        DelayStep<T>(delay) +
        OpacityStep<T>(
          initialOpacity: 1.0,
          stepDuration: fadeOutDuration,
          interStepDelay: Duration.zero,
          curve: curve,
          finalOpacity: 0.0,
        );
  }

  static PipelineStep<T> opacityAndTransform<T extends AnimationBuilder<T>>({
    double initialOpacity = 1.0,
    double finalOpacity = 1.0,
    Matrix4? initialMatrix,
    Matrix4? finalMatrix,
    Duration stepDuration = const Duration(milliseconds: 1500),
    Duration interStepDelay = const Duration(milliseconds: 30),
    Curve curve = Curves.easeInOutQuad,
    Alignment transformAlignment = Alignment.center,
  }) {
    return OpacityStep<T>(
          initialOpacity: initialOpacity,
          stepDuration: stepDuration,
          interStepDelay: interStepDelay,
          curve: curve,
          finalOpacity: finalOpacity,
        ) +
        TransformStep<T>(
          initialMatrix: initialMatrix,
          finalMatrix: finalMatrix,
          stepDuration: stepDuration,
          interStepDelay: interStepDelay,
          curve: curve,
          transformAlignment: transformAlignment,
        );
  }
}
