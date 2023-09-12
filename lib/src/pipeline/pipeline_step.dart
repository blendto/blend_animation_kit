import 'package:blend_animation_kit/blend_animation_kit.dart';

abstract class PipelineStep {
  final PipelineStep? nextStep;

  PipelineStep({this.nextStep});

  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder);

  PipelineStep chain(PipelineStep next) {
    return copyWith(nextStep: next);
  }

  PipelineStep copyWith({PipelineStep? nextStep});
}
