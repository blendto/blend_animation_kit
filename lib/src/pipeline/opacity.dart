import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:flutter/widgets.dart';

class OpacityStep extends PipelineStep {
  final double initialOpacity;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final double finalOpacity;

   OpacityStep({
    required this.initialOpacity,
    required this.stepDuration,
    required this.interStepDelay,
    required this.curve,
    required this.finalOpacity,
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  String get tag =>
      "Opacity $initialOpacity-$finalOpacity:${stepDuration.inMilliseconds}";

  @override
  OpacityStep copyWith({PipelineStep? nextStep}) {
    return OpacityStep(
      initialOpacity: initialOpacity,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      curve: curve,
      finalOpacity: finalOpacity,
      nextStep: nextStep ?? this.nextStep,
    );
  }

  @override
  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder) {
    final newSceneItems = List.of(builder.sceneItems);
    for (var (index, _) in builder.animationInput.groups.indexed) {
      final property = builder.animationProperties.elementAt(index).opacity;
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Tween<double>(begin: initialOpacity, end: finalOpacity),
        curve: curve,
        from: builder.begin + (interStepDelay * index),
        duration: stepDuration,
      ));
    }

    return builder.copyWith(sceneItems: newSceneItems);
  }
}
