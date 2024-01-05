import 'dart:collection';

import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/text_animation_builder.dart';

class WaitStep extends PipelineStep {
  static String get wireName => "Wait";

  const WaitStep({PipelineStep? nextStep}) : super(nextStep: nextStep);

  @override
  String get tag => "Wait";

  @override
  PipelineStep copyWith({PipelineStep? nextStep}) {
    return WaitStep(nextStep: nextStep ?? this.nextStep);
  }

  @override
  BaseAnimationBuilder updatedBuilder(BaseAnimationBuilder builder) {
    final begin = builder.tween.duration;
    return builder.copyWith(begin: begin);
  }

  @override
  Map<String, dynamic> get serialised {
    return HashMap()..putIfAbsent("name", () => wireName);
  }

  static WaitStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep? nextStep,
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
