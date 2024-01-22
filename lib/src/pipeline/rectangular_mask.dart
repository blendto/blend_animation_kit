import 'dart:collection';

import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/blend_animation_builder.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/serializers/cubic.dart';
import 'package:flutter/material.dart';

class RectangularMaskStep extends PipelineStep {
  final Duration stepDuration;
  final Curve curve;
  final EdgeInsets initialFractionalEdgeInsets;
  final EdgeInsets finalFractionalEdgeInsets;
  final Duration interStepDelay;

  static String get wireName => "RectangularMask";

  const RectangularMaskStep({
    this.initialFractionalEdgeInsets = EdgeInsets.zero,
    this.finalFractionalEdgeInsets = EdgeInsets.zero,
    this.stepDuration = const Duration(milliseconds: 1500),
    this.interStepDelay = const Duration(milliseconds: 30),
    this.curve = Curves.easeInOutQuad,
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  PipelineStep copyWith({PipelineStep? nextStep}) {
    return RectangularMaskStep(
      stepDuration: stepDuration,
      curve: curve,
      nextStep: nextStep ?? this.nextStep,
    );
  }

  @override
  BlendAnimationBuilder updatedBuilder(BlendAnimationBuilder builder) {
    final newSceneItems = List.of(builder.sceneItems);
    for (var (index, _) in builder.animationInput.groups.indexed) {
      final property =
          builder.animationProperties.elementAt(index).rectangularMask;
      newSceneItems.add(ScenePropertyItem(
        property: property,
        tween: EdgeInsetsTween(
          begin: initialFractionalEdgeInsets,
          end: finalFractionalEdgeInsets,
        ),
        curve: curve,
        from: builder.begin + (interStepDelay * index),
        duration: stepDuration,
      ));
    }

    return builder.copyWith(sceneItems: newSceneItems);
  }

  @override
  String get tag => "RectangularMask ${stepDuration.inMilliseconds}";

  @override
  Map<String, dynamic> get serialised {
    return HashMap()
      ..putIfAbsent("name", () => wireName)
      ..putIfAbsent(
          "initialFractionalEdgeInsetsLTRB",
          () => [
                initialFractionalEdgeInsets.left,
                initialFractionalEdgeInsets.top,
                initialFractionalEdgeInsets.right,
                initialFractionalEdgeInsets.bottom
              ])
      ..putIfAbsent(
          "finalFractionalEdgeInsetsLTRB",
          () => [
                finalFractionalEdgeInsets.left,
                finalFractionalEdgeInsets.top,
                finalFractionalEdgeInsets.right,
                finalFractionalEdgeInsets.bottom
              ])
      ..putIfAbsent("curve", () => CurveSerializer.serialize(curve))
      ..putIfAbsent("duration", () => stepDuration.inMilliseconds);
  }

  static RectangularMaskStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep? nextStep,
  ) {
    final delay = Duration(milliseconds: obj["duration"]);
    final initialInsets =
        obj["initialFractionalEdgeInsetsLTRB"] as List<double>;
    final finalInsets = obj["finalFractionalEdgeInsetsLTRB"] as List<double>;
    final curve = CurveSerializer.deserialize(obj['curve']);

    return RectangularMaskStep(
      initialFractionalEdgeInsets: EdgeInsets.fromLTRB(
        initialInsets[0],
        initialInsets[1],
        initialInsets[2],
        initialInsets[3],
      ),
      finalFractionalEdgeInsets: EdgeInsets.fromLTRB(
        finalInsets[0],
        finalInsets[1],
        finalInsets[2],
        finalInsets[3],
      ),
      curve: curve,
      stepDuration: delay,
      nextStep: nextStep,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is RectangularMaskStep &&
        stepDuration == other.stepDuration &&
        nextStep == other.nextStep;
  }

  @override
  int get hashCode => Object.hashAll([stepDuration, nextStep]);
}
