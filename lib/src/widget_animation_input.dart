import 'package:flutter/material.dart';

import 'animation_property.dart';

class WidgetAnimationInput {
  final Widget widget;

  late final AnimationProperty animationProperty = AnimationProperty();

  WidgetAnimationInput({
    required this.widget,
  });
}
