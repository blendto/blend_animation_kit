import 'dart:collection';

import 'package:blend_animation_kit/src/base_animation_builder.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';

class WaitStep<T extends AnimationBuilder<T>> extends PipelineStep<T> {
  static String get wireName => "Wait";

  const WaitStep({PipelineStep<T>? nextStep}) : super(nextStep: nextStep);

  @override
  String get tag => "Wait";

  @override
  PipelineStep<T> copyWith({PipelineStep<T>? nextStep}) {
    return WaitStep(nextStep: nextStep ?? this.nextStep);
  }

  @override
  T updatedBuilder(T builder) {
    final begin = builder.tween.duration;
    return builder.copyWith(begin: begin);
  }

  @override
  Map<String, dynamic> get serialised {
    return HashMap()..putIfAbsent("name", () => wireName);
  }

  static WaitStep<T> deserialise<T extends AnimationBuilder<T>>(
    Map<String, dynamic> obj,
    PipelineStep<T>? nextStep,
  ) {
    return WaitStep(nextStep: nextStep);
  }

  @override
  bool operator ==(Object other) {
    return other is WaitStep && nextStep == other.nextStep;
  }

  @override
  int get hashCode => Object.hashAll([nextStep]);
}
