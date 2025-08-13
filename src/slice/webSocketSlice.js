import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    status:"connecting",
    pumpMessage:"",
    disconnectEvents:[],
    error:null,
}
const webSocketSlice = createSlice({
    name:"websocket",
    initialState,
    reducers:{
        setStatus:(state,action)=>{
            state.status = action.payload
        },
        setPumpMessage: (state,action)=>{
            state.pumpMessage = action.payload
        },
        addDisconnectEvent: (state, action) => {
            state.disconnectEvents.unshift(action.payload);
        },
        setError: (state, action) => {
        state.error = action.payload;
        },
        resetWebSocket: () => initialState,
    
    }
});

export const {
    setStatus,
    setPumpMessage,
    addDisconnectEvent,
    setError,
    resetWebSocket
} = webSocketSlice.actions;

export default webSocketSlice.reducer;