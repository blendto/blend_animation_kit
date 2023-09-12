import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/widgets.dart';

class TransformStep extends PipelineStep {
  final Matrix4 initialMatrix;
  final Matrix4 finalMatrix;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final Alignment transformAlignment;

  TransformStep({
    required this.initialMatrix,
    required this.finalMatrix,
    required this.stepDuration,
    required this.interStepDelay,
    required this.curve,
    this.transformAlignment = Alignment.center,
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  String get tag => "Transform :${stepDuration.inMilliseconds}";

  @override
  TransformStep copyWith({PipelineStep? nextStep}) {
    return TransformStep(
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
