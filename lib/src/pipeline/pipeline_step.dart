import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:blend_animation_kit/src/base_animation_builder.dart';

abstract class PipelineStep<T extends AnimationBuilder<T>> {
  final PipelineStep<T>? nextStep;

  const PipelineStep({this.nextStep});

  String get tag;

  T updatedBuilder(T builder);

  PipelineStep<T> chain(PipelineStep<T> next) {
    if (nextStep != null) {
      return copyWith(nextStep: nextStep! + next);
    }
    return copyWith(nextStep: next);
  }

  PipelineStep<T> operator +(PipelineStep<T> other) => chain(other);

  PipelineStep<T> copyWith({PipelineStep<T>? nextStep});

  int get length {
    int i = 0;
    PipelineStep<T>? curr = this;
    while (curr != null) {
      i += 1;
      curr = curr.nextStep;
    }
    return i;
  }

  @override
  String toString() {
    final StringBuffer stringBuffer = StringBuffer();
    PipelineStep<T>? curr = this;
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

  static PipelineStep<T> deserialise<T extends AnimationBuilder<T>>(
    Map<String, dynamic> element,
    PipelineStep<T>? step,
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

  static PipelineStep<T>? fromList<T extends AnimationBuilder<T>>(
      List<Map<String, dynamic>> flattened) {
    PipelineStep<T>? step;
    for (final element in flattened.reversed) {
      step = deserialise<T>(element, step);
    }

    return step;
  }

  Map<String, dynamic> get serialised;
}
