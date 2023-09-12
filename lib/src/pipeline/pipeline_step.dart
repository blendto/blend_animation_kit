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

  operator +(PipelineStep other) => chain(other);

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

  List<Map<String, dynamic>> get flattened {
    List<Map<String, dynamic>> list = [serialised];
    if (nextStep != null) {
      list.addAll(nextStep!.flattened);
    }
    return list;
  }

  static PipelineStep deserialise(
    Map<String, dynamic> element,
    PipelineStep? step,
  ) {
    String name = element["name"];
    if (name == OpacityStep.wireName) {
      return OpacityStep.deserialise(element, step);
    }
    if (name == TransformStep.wireName) {
      return TransformStep.deserialise(element, step);
    }
    if (name == DelayStep.wireName) {
      return DelayStep.deserialise(element, step);
    }
    if (name == WaitStep.wireName) {
      return WaitStep.deserialise(element, step);
    }

    throw UnsupportedError("Unrecognised wireName: $name");
  }

  PipelineStep? fromList(List<Map<String, dynamic>> flattened) {
    PipelineStep? step;
    for (final element in flattened.reversed) {
      step = deserialise(element, step);
    }

    return step;
  }

  Map<String, dynamic> get serialised;
}
