import 'dart:collection';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:flutter/widgets.dart';

class OpacityStep extends PipelineStep {
  final double initialOpacity;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final double finalOpacity;

  const OpacityStep({
    this.initialOpacity = 1.0,
    this.stepDuration = const Duration(milliseconds: 1500),
    this.interStepDelay = const Duration(milliseconds: 30),
    this.curve = Curves.easeInOutQuad,
    this.finalOpacity = 1.0,
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

  @override
  Map<String, dynamic> get serialised {
    Map<String, dynamic> obj = HashMap();

    obj.putIfAbsent("name", () => "Opacity");
    obj.putIfAbsent("initialOpacity", () => initialOpacity);
    obj.putIfAbsent("stepDuration", () => stepDuration.inMilliseconds);
    obj.putIfAbsent("interStepDelay", () => interStepDelay.inMilliseconds);
    obj.putIfAbsent("finalOpacity", () => finalOpacity);

    return obj;
  }

  static OpacityStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep nextStep,
  ) {
    double initialOpacity = obj["initialOpacity"];
    Duration stepDuration = Duration(milliseconds: obj["stepDuration"]);
    Duration interStepDelay = Duration(milliseconds: obj["interStepDelay"]);
    double finalOpacity = obj["finalOpacity"];

    return OpacityStep(
      initialOpacity: initialOpacity,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      finalOpacity: finalOpacity,
      nextStep: nextStep,
    );
  }
}
