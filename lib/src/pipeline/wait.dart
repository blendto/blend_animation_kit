import 'package:blend_animation_kit/src/pipeline/pipeline_step.dart';
import 'package:blend_animation_kit/src/text_animation_builder.dart';

class WaitStep extends PipelineStep {
  WaitStep({PipelineStep? nextStep}) : super(nextStep: nextStep);

  @override
  String get tag => "Wait";

  @override
  PipelineStep copyWith({PipelineStep? nextStep}) {
    return WaitStep(nextStep: nextStep ?? this.nextStep);
  }

  @override
  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder) {
    final begin = builder.tween.duration;
    return builder.copyWith(begin: begin);
  }
}
