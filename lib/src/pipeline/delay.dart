import 'dart:collection';

import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/blend_animation_builder.dart';

class DelayStep extends PipelineStep {
  final Duration delay;

  static String get wireName => "Delay";

  const DelayStep(
    this.delay, {
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  PipelineStep copyWith({PipelineStep? nextStep}) {
    return DelayStep(delay, nextStep: nextStep ?? this.nextStep);
  }

  @override
  BlendAnimationBuilder updatedBuilder(BlendAnimationBuilder builder) {
    final newBegin = delay + builder.tween.duration;
    return builder.copyWith(
      begin: newBegin,
      sceneItems: List.from(builder.sceneItems)
        ..add(PauseScene(duration: delay, from: builder.tween.duration)),
    );
  }

  @override
  String get tag => "Delay ${delay.inMilliseconds}";

  @override
  Map<String, dynamic> get serialised {
    return HashMap()
      ..putIfAbsent("name", () => wireName)
      ..putIfAbsent("delay", () => delay.inMilliseconds);
  }

  static DelayStep deserialise(
    Map<String, dynamic> obj,
    PipelineStep? nextStep,
  ) {
    final delay = Duration(milliseconds: obj["delay"]);
    return DelayStep(delay, nextStep: nextStep);
  }

  @override
  bool operator ==(Object other) {
    return other is DelayStep &&
        delay == other.delay &&
        nextStep == other.nextStep;
  }

  @override
  int get hashCode => Object.hashAll([delay, nextStep]);
}
