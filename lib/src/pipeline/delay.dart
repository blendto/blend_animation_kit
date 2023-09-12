import 'package:blend_animation_kit/src/animation_property.dart';
import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/text_animation_builder.dart';

class Delay extends PipelineStep {
  final Duration delay;

  Delay(
    this.delay, {
    PipelineStep? nextStep,
  }) : super(nextStep: nextStep);

  @override
  PipelineStep copyWith({PipelineStep? nextStep}) {
    return Delay(delay, nextStep: nextStep ?? this.nextStep);
  }

  @override
  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder) {
    final newBegin = delay + builder.tween.duration;
    return builder.copyWith(
      begin: newBegin,
      sceneItems: List.from(builder.sceneItems)
        ..add(PauseScene(duration: delay, from: builder.tween.duration)),
    );
  }
}
