import 'dart:math';

import 'package:custom_text_animations/src/helpers/flutter_sequence_animation/flutter_sequence_animation.dart';
import 'package:flutter/material.dart';

const _chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
Random _rnd = Random();

String getRandomString(int length) => String.fromCharCodes(Iterable.generate(
    length, (_) => _chars.codeUnitAt(_rnd.nextInt(_chars.length))));

String get randomStr => getRandomString(5);

class SequenceAnimationTag<T> {
  const SequenceAnimationTag(this.id);

  final String id;

  static SequenceAnimationTag random<T>() {
    return SequenceAnimationTag<T>(randomStr);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SequenceAnimationTag &&
          runtimeType == other.runtimeType &&
          id == other.id;

  Animation<T> getAnimation(SequenceAnimation sequenceAnimation) {
    return sequenceAnimation.get(this);
  }

  @override
  int get hashCode => id.hashCode;
}

class SequenceAnimationTagList<T> {
  final List<SequenceAnimationTag<T>> _tags = [];
  final String tagId;

  SequenceAnimationTagList({required this.tagId});

  SequenceAnimationTag<T> addTag() {
    final tag = SequenceAnimationTag<T>("$tagId-${_tags.length}");
    _tags.add(tag);
    return tag;
  }

  SequenceAnimationTag<T> getTag(int index) {
    return _tags[index];
  }

  Animation<T> getAnimation(SequenceAnimation sequenceAnimation, int index) {
    return getTag(index).getAnimation(sequenceAnimation);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SequenceAnimationTagList &&
          runtimeType == other.runtimeType &&
          _tags == other._tags;

  @override
  int get hashCode => _tags.hashCode;
}
