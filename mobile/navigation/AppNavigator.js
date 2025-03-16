import { createStackNavigator } from '@react-navigation/stack';
import UsersScreen from '../screens/UsersScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Users"
                component={UsersScreen}
                options={{ title: 'Chat Users' }}
            />
            <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={({ route }) => ({
                    title: route.params.otherUser.name
                })}
            />
        </Stack.Navigator>
    );
} 