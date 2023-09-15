import 'dart:collection';
import 'dart:typed_data';

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/serializers/alignment.dart';
import 'package:blend_animation_kit/src/serializers/cubic.dart';
import 'package:flutter/widgets.dart';

final identityMatrixStorage = Matrix4.identity().storage;

class TransformStep extends PipelineStep {
  final Matrix4? initialMatrix;
  final Matrix4? finalMatrix;
  final Duration stepDuration;
  final Duration interStepDelay;
  final Curve curve;
  final Alignment transformAlignment;

  static String get wireName => "Transform";

  const TransformStep({
    this.initialMatrix,
    this.finalMatrix,
    this.stepDuration = const Duration(milliseconds: 1500),
    this.interStepDelay = const Duration(milliseconds: 30),
    this.curve = Curves.easeInOutQuad,
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
          begin: initialMatrix ?? Matrix4.identity(),
          end: finalMatrix ?? Matrix4.identity(),
          transformAlignment: transformAlignment,
        ),
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
    obj.putIfAbsent(
        "initialMatrix", () => initialMatrix?.storage ?? identityMatrixStorage);
    obj.putIfAbsent(
        "finalMatrix", () => finalMatrix?.storage ?? identityMatrixStorage);
    obj.putIfAbsent("stepDuration", () => stepDuration.inMilliseconds);
    obj.putIfAbsent("interStepDelay", () => interStepDelay.inMilliseconds);
    obj.putIfAbsent("curve", () => CurveSerializer.serialize(curve));
    obj.putIfAbsent("transformAlignment",
        () => AlignmentSerializer.serialize(transformAlignment));
    return obj;
  }

  static TransformStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep? nextStep,
  ) {
    Float64List initialMatrixStorage =
        obj["initialMatrix"] ?? identityMatrixStorage;
    Float64List finalMatrixStorage =
        obj["finalMatrix"] ?? identityMatrixStorage;
    return TransformStep(
      initialMatrix: Matrix4.fromFloat64List(initialMatrixStorage),
      finalMatrix: Matrix4.fromFloat64List(finalMatrixStorage),
      stepDuration: Duration(milliseconds: obj["stepDuration"]),
      interStepDelay: Duration(milliseconds: obj["interStepDelay"]),
      nextStep: nextStep,
      transformAlignment:
          AlignmentSerializer.deserialize(obj['transformAlignment']),
      curve: CurveSerializer.deserialize(obj['curve']),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is TransformStep &&
        initialMatrix == other.initialMatrix &&
        curve == other.curve &&
        stepDuration == other.stepDuration &&
        finalMatrix == other.finalMatrix &&
        transformAlignment == other.transformAlignment &&
        interStepDelay == other.interStepDelay &&
        nextStep == other.nextStep;
  }

  @override
  int get hashCode => Object.hashAll([
        initialMatrix,
        finalMatrix,
        curve,
        stepDuration,
        interStepDelay,
        transformAlignment,
        nextStep
      ]);
}
