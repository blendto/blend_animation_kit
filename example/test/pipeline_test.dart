// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:blend_animation_kit/blend_animation_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test("Pipeline steps serialization deserialization", () {
    final PipelineStep pipeline = const OpacityStep(
          initialOpacity: 0.0,
          finalOpacity: 1.0,
          stepDuration: Duration(milliseconds: 800),
          curve: Curves.easeInOutQuad,
          interStepDelay: Duration(milliseconds: 50),
        ) +
        TransformStep(
          initialMatrix: Matrix4.identity()..translate(4.0),
          finalMatrix: Matrix4.identity(),
          stepDuration: const Duration(milliseconds: 800),
          interStepDelay: const Duration(milliseconds: 50),
          curve: Curves.bounceIn,
          transformAlignment: Alignment.bottomCenter,
        ) +
        const WaitStep() +
        const DelayStep(Duration(seconds: 1));

    expect(pipeline, PipelineStep.fromList(pipeline.flattened));
  });

  test("serialize/deserialize json", () {
    final json = [
      {
        "initialOpacity": 1,
        "name": "Opacity",
        "finalOpacity": 1,
        "curve": "elasticOut",
        "stepDuration": 1500,
        "interStepDelay": 45
      },
      {
        "transformAlignment": "-1.0,1.0",
        "curve": "elasticOut",
        "stepDuration": 1500,
        "interStepDelay": 45,
        "name": "Transform",
        "initialMatrix": [
          0.001,
          0,
          0,
          0,
          0,
          0.001,
          0,
          0,
          0,
          0,
          0.001,
          0,
          0,
          0,
          0,
          1
        ],
        "finalMatrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      },
      {"name": "Wait"},
      {"name": "Delay", "delay": 1000},
      {
        "initialOpacity": 1,
        "name": "Opacity",
        "finalOpacity": 0,
        "curve": "easeInOutQuad",
        "stepDuration": 1000,
        "interStepDelay": 0
      }
    ];
    expect(PipelineStep.fromList(json)!.flattened, json);
  });
}
