import 'package:example/predefined_animations.dart';
import 'package:flutter/material.dart';

class TextDemo extends StatefulWidget {
  const TextDemo({super.key, required this.title});

  final String title;

  @override
  State<TextDemo> createState() => _TextDemoState();
}

class _TextDemoState extends State<TextDemo> {
  List<Widget> get widgets => [
        variant2(customText ?? "Great Thinkers", const TextStyle(fontSize: 40)),
        variant3(
            customText ?? "Coffee mornings", const TextStyle(fontSize: 30)),
        variant4(
            customText ?? "Beautiful Questions", const TextStyle(fontSize: 30)),
        variant5(customText ?? "Animation 6", const TextStyle(fontSize: 40)),
        variant6(customText ?? "Animation 7", const TextStyle(fontSize: 40)),
      ];

  String? customText;
  final textFieldController = TextEditingController();

  @override
  void dispose() {
    textFieldController.dispose();
    super.dispose();
  }

  double sliderVal = 1;
  bool sliderActive = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            children: [
              TextField(
                controller: textFieldController,
                decoration: InputDecoration(
                  hintText: "Enter any text",
                  suffixIcon: TextButton.icon(
                    onPressed: () {
                      if (!mounted) return;
                      setState(() {
                        customText = null;
                      });
                      textFieldController.clear();
                      FocusManager.instance.primaryFocus?.unfocus();
                    },
                    icon: const Icon(Icons.cancel),
                    label: const Text("Cancel"),
                  ),
                ),
                onChanged: (val) {
                  if (!mounted) return;
                  setState(() {
                    customText = val;
                  });
                },
              ),
              Expanded(
                child: Scrollbar(
                  child: ListView.separated(
                    key: ValueKey(customText),
                    padding: const EdgeInsets.all(10),
                    separatorBuilder: (context, index) => const SizedBox(
                      height: 10,
                    ),
                    itemCount: widgets.length,
                    itemBuilder: (context, index) {
                      return Center(
                        child: LayoutBuilder(builder: (context, constraints) {
                          return Container(
                            width: sliderActive
                                ? constraints.maxWidth * sliderVal
                                : null,
                            decoration: BoxDecoration(
                                border: Border.all(color: Colors.red)),
                            child: widgets[index],
                          );
                        }),
                      );
                    },
                  ),
                ),
              ),
              Slider(
                min: 0,
                max: 1,
                value: sliderVal,
                onChanged: sliderActive
                    ? (val) {
                        setState(() {
                          sliderVal = val;
                        });
                      }
                    : null,
              ),
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Change Width"),
                    Checkbox(
                        value: sliderActive,
                        onChanged: (val) {
                          setState(() {
                            sliderActive = val ?? false;
                            sliderVal = 1.0;
                          });
                        }),
                  ],
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
