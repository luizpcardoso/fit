import { useLocalSearchParams } from 'expo-router';
import SocialFeedScreen from '@/components/social-feed-screen';
export default function GroupDetail() { const {id}=useLocalSearchParams<{id:string}>(); return <SocialFeedScreen key={id} groupId={id}/>; }
