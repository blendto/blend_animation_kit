import 'dart:ui';

class AnimationBoxInfo<T> {
  final T subject;

  final Rect rect;

  final int index;

  const AnimationBoxInfo({
    required this.subject,
    required this.rect,
    required this.index,
  });
}

class GroupDetails<T> {
  final Size overallBoxSize;

  final List<AnimationBoxInfo<T>> boxes;

  const GroupDetails(this.overallBoxSize, this.boxes);
}
