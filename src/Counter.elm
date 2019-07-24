port module Counter exposing (main)

import Browser
import Browser.Events
import Html exposing (Html, button, div, text)
import Html.Events exposing (onClick)
import Json.Decode as Decode
import Json.Encode as Encode exposing (Value)


port shutdownRequested : (() -> msg) -> Sub msg


port attrChanged : (String -> msg) -> Sub msg


port anotherChanged : (Value -> msg) -> Sub msg


port fromElm : Value -> Cmd msg


type alias Model =
    { count : Int, activeState : ActiveState }


type ActiveState
    = Running
    | Stopped


type Msg
    = Increment
    | Decrement
    | ShutdownRequested
    | AttrChanged String
    | DocumentClicked
    | AnotherChanged Value


subscriptions { activeState } =
    case activeState of
        Running ->
            Sub.batch
                [ Browser.Events.onClick (Decode.succeed DocumentClicked)
                , shutdownRequested (always ShutdownRequested)
                , attrChanged AttrChanged
                , anotherChanged AnotherChanged
                ]

        Stopped ->
            -- Remove subscription to avoid leaks
            Sub.none


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        AnotherChanged value ->
            ( Debug.log "Do something with 'another' = ..." model, Cmd.none )

        AttrChanged value ->
            ( Debug.log ("Do something with 'attr' = " ++ value) model, Cmd.none )

        Increment ->
            let
                newCount =
                    model.count + 1
            in
            ( { model | count = newCount }, fromElm (Encode.object [ ( "count", Encode.int newCount ) ]) )

        Decrement ->
            let
                newCount =
                    model.count - 1
            in
            ( { model | count = newCount }, fromElm (Encode.object [ ( "count", Encode.int newCount ) ]) )

        ShutdownRequested ->
            ( { model | activeState = Stopped }
                |> Debug.log "Detach 'Browser' handlers here to avoid leaks..."
              , Cmd.none
            )

        DocumentClicked ->
            ( Debug.log "Do something with this DocumentClicked subscription Msg..." model, Cmd.none )


view : Model -> Html Msg
view model =
    div []
        [ button [ onClick Increment ] [ text "+1" ]
        , div [] [ text <| String.fromInt model.count ]
        , button [ onClick Decrement ] [ text "-1" ]
        ]


main : Program { count : Int } Model Msg
main =
    Browser.element
        { init = \{ count } -> ( { count = count, activeState = Running }, Cmd.none )
        , subscriptions = subscriptions
        , view = view
        , update = update
        }
