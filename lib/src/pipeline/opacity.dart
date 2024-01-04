import 'dart:collection';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/base_animation_builder.dart';
import 'package:blend_animation_kit/src/serializers/cubic.dart';
import 'package:flutter/widgets.dart';

class OpacityStep<T extends AnimationBuilder<T>> extends PipelineStep<T> {
  final double initialOpacity;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final double finalOpacity;

  static String get wireName => "Opacity";

  const OpacityStep({
    this.initialOpacity = 1.0,
    this.stepDuration = const Duration(milliseconds: 1500),
    this.interStepDelay = const Duration(milliseconds: 30),
    this.curve = Curves.easeInOutQuad,
    this.finalOpacity = 1.0,
    PipelineStep<T>? nextStep,
  }) : super(nextStep: nextStep);

  @override
  String get tag =>
      "Opacity $initialOpacity-$finalOpacity:${stepDuration.inMilliseconds}";

  @override
  OpacityStep<T> copyWith({PipelineStep<T>? nextStep}) {
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
  T updatedBuilder(T builder) {
    final newSceneItems = List.of(builder.sceneItems);
    var index = 0;
    for (var animationProperty in builder.animationProperties) {
      final property = animationProperty.opacity;
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: Tween<double>(begin: initialOpacity, end: finalOpacity),
        curve: curve,
        from: builder.begin + (interStepDelay * index),
        duration: stepDuration,
      ));
      index++;
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

  static OpacityStep<T> deserialise<T extends AnimationBuilder<T>>(
    Map<String, dynamic> obj,
    PipelineStep<T>? nextStep,
  ) {
    double initialOpacity = double.parse("${obj["initialOpacity"]}");
    double finalOpacity = double.parse("${obj["finalOpacity"]}");
    Duration stepDuration = Duration(milliseconds: obj["stepDuration"]);
    Duration interStepDelay = Duration(milliseconds: obj["interStepDelay"]);
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
