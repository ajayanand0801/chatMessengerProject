import { useState } from "react";
import { User } from "@shared/schema";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ProfileImageProps {
  user: User;
  size?: "sm" | "md" | "lg";
  showUpload?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-20 w-20",
};

export function ProfileImage({ user, size = "md", showUpload = false }: ProfileImageProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const response = await fetch('/api/profile-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to upload profile image');

      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });

      toast({
        title: "Profile image updated",
        description: "Your profile image has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={user.profileImage} />
        <AvatarFallback>
          {user.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {showUpload && (
        <div className="absolute bottom-0 right-0">
          <input
            type="file"
            id="profile-image"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <label htmlFor="profile-image">
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full"
              disabled={isUploading}
              asChild
            >
              <span>
                <Camera className="h-3 w-3" />
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
