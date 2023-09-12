import 'package:blend_animation_kit/src/pipeline/delay.dart';
import 'package:blend_animation_kit/src/pipeline/opacity.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/pipeline/transform.dart';
import 'package:blend_animation_kit/src/pipeline/wait.dart';
import 'package:flutter/material.dart';

class PipelineHelpers {
  static PipelineStep waitAndFadeOutAll({
    Duration fadeOutDuration = const Duration(seconds: 1),
    Duration delay = const Duration(seconds: 1),
    Curve curve = Curves.easeInOutQuad,
  }) {
    return WaitStep().chain(DelayStep(delay)).chain(OpacityStep(
          initialOpacity: 1.0,
          stepDuration: fadeOutDuration,
          interStepDelay: Duration.zero,
          curve: curve,
          finalOpacity: 0.0,
        ));
  }

  static PipelineStep opacityAndTransform({
    required double initialOpacity,
    required double finalOpacity,
    required Matrix4 initialMatrix,
    required Matrix4 finalMatrix,
    required Duration stepDuration,
    required Duration interStepDelay,
    required Curve curve,
    Alignment transformAlignment = Alignment.center,
  }) {
    return OpacityStep(
      initialOpacity: initialOpacity,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      finalOpacity: finalOpacity,
    ).chain(TransformStep(
      initialMatrix: initialMatrix,
      finalMatrix: finalMatrix,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      transformAlignment: transformAlignment,
    ));
  }
}
