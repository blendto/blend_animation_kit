import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:flutter/widgets.dart';

class Transform extends PipelineStep {
  final Matrix4 initialMatrix;
  final Matrix4 finalMatrix;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final Alignment transformAlignment;

  Transform({
    required this.initialMatrix,
    required this.finalMatrix,
    required this.stepDuration,
    required this.interStepDelay,
    required this.curve,
    this.transformAlignment = Alignment.center,
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  Transform copyWith({PipelineStep? nextStep}) {
    throw Transform(
      initialMatrix: initialMatrix,
      finalMatrix: finalMatrix,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      transformAlignment: transformAlignment,
      nextStep: nextStep ?? this.nextStep,
    );
  }

  @override
  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder) {
    final newSceneItems = List.of(builder.sceneItems);
    for (var (index, _) in builder.animationInput.groups.indexed) {
      final property =
          builder.animationProperties.elementAt(index).transformation;
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Matrix4WithAlignmentTween(
          begin: initialMatrix,
          end: finalMatrix,
          transformAlignment: transformAlignment,
        ),
        curve: curve,
        from: builder.begin + (interStepDelay * index),
        duration: stepDuration,
      ));
    }

    return builder.copyWith(sceneItems: newSceneItems);
  }
}
