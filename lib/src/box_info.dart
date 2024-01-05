import 'dart:ui';

class AnimationBoxInfo {
  final Rect rect;

  final int index;

  const AnimationBoxInfo({required this.rect, required this.index});
}

class TextBoxInfo extends AnimationBoxInfo {
  final String character;

  const TextBoxInfo({
    required super.rect,
    required super.index,
    required this.character,
  });
}
