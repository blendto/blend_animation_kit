import 'dart:collection';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/serializers/cubic.dart';
import 'package:flutter/widgets.dart';

class OpacityStep extends PipelineStep {
  final num initialOpacity;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final num finalOpacity;

  static String get wireName => "Opacity";

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
        tween: Tween<double>(
            begin: initialOpacity.toDouble(), end: finalOpacity.toDouble()),
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

    obj.putIfAbsent("name", () => wireName);
    obj.putIfAbsent("initialOpacity", () => initialOpacity);
    obj.putIfAbsent("stepDuration", () => stepDuration.inMilliseconds);
    obj.putIfAbsent("interStepDelay", () => interStepDelay.inMilliseconds);
    obj.putIfAbsent("finalOpacity", () => finalOpacity);
    obj.putIfAbsent("curve", () => CurveSerializer.serialize(curve));

    return obj;
  }

  static OpacityStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep? nextStep,
  ) {
    num initialOpacity = obj["initialOpacity"];
    Duration stepDuration = Duration(milliseconds: obj["stepDuration"]);
    Duration interStepDelay = Duration(milliseconds: obj["interStepDelay"]);
    num finalOpacity = obj["finalOpacity"];
    Curve curve = CurveSerializer.deserialize(obj['curve']);

    return OpacityStep(
      initialOpacity: initialOpacity,
      stepDuration: stepDuration,
      interStepDelay: interStepDelay,
      finalOpacity: finalOpacity,
      nextStep: nextStep,
      curve: curve,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is OpacityStep &&
        initialOpacity == other.initialOpacity &&
        curve == other.curve &&
        stepDuration == other.stepDuration &&
        finalOpacity == other.finalOpacity &&
        interStepDelay == other.interStepDelay &&
        nextStep == other.nextStep;
  }

  @override
  int get hashCode => Object.hashAll([
        initialOpacity,
        finalOpacity,
        stepDuration,
        interStepDelay,
        curve,
        nextStep,
      ]);
}
