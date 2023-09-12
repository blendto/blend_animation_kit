import 'package:blend_animation_kit/blend_animation_kit.dart';

abstract class PipelineStep {
  final PipelineStep? nextStep;

  const PipelineStep({this.nextStep});

  String get tag;

  TextAnimationBuilder updatedBuilder(TextAnimationBuilder builder);

  PipelineStep chain(PipelineStep next) {
    if (nextStep != null) {
      return copyWith(nextStep: nextStep!.chain(next));
    }
    return copyWith(nextStep: next);
  }

  PipelineStep copyWith({PipelineStep? nextStep});

  int get length {
    int i = 0;
    PipelineStep? curr = this;
    while (curr != null) {
      i += 1;
      curr = curr.nextStep;
    }
    return i;
  }

  @override
  String toString() {
    final StringBuffer stringBuffer = StringBuffer();
    PipelineStep? curr = this;
    while (curr != null) {
      stringBuffer.write(curr.tag);
      curr = curr.nextStep;
      if (curr != null) {
        stringBuffer.write("->");
      }
    }
    return stringBuffer.toString();
  }
}
