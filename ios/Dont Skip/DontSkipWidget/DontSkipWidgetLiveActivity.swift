//
//  DontSkipWidgetLiveActivity.swift
//  DontSkipWidget
//
//  Created by Herbert Kanengoni on 27/08/2025.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct DontSkipWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct DontSkipWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DontSkipWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension DontSkipWidgetAttributes {
    fileprivate static var preview: DontSkipWidgetAttributes {
        DontSkipWidgetAttributes(name: "World")
    }
}

extension DontSkipWidgetAttributes.ContentState {
    fileprivate static var smiley: DontSkipWidgetAttributes.ContentState {
        DontSkipWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: DontSkipWidgetAttributes.ContentState {
         DontSkipWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: DontSkipWidgetAttributes.preview) {
   DontSkipWidgetLiveActivity()
} contentStates: {
    DontSkipWidgetAttributes.ContentState.smiley
    DontSkipWidgetAttributes.ContentState.starEyes
}
